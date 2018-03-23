import { _ } from 'lodash';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Image,
    Text,
    TouchableOpacity,
    StyleSheet,
    View,
} from 'react-native';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import randomColor from 'randomcolor';
import { graphql, compose } from 'react-apollo';
import update from 'immutability-helper';
import { Buffer } from 'buffer';
import Message from '../components/message.component';
import MessageInput from '../components/message-input.component';
import GROUP_QUERY from '../graphql/group.query';
import CREATE_MESSAGE_MUTATION from '../graphql/create-message.mutation';

const styles = StyleSheet.create({
    container: {
        alignItems: 'stretch',
        backgroundColor: '#e5ddd5',
        flex: 1,
        flexDirection: 'column',
    },
    loading: {
        justifyContent: 'center',
    },
    titleWrapper: {
        alignItems: 'center',
        position: 'absolute',
        left: 0,
        right: 0,
    },
    title: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleImage: {
        marginRight: 6,
        width: 32,
        height: 32,
        borderRadius: 16,
    },

});

// const fakeData = () => _.times(100, i => ({
//     // every message will have a different color
//     color: randomColor(),
//     // every 5th message will look like it's from the current user
//     isCurrentUser: i % 5 === 0,
//     message: {
//         id: i,
//         createdAt: new Date().toISOString(),
//         from: {
//             username: `Username ${i}`,
//         },
//         text: `Message ${i}`,
//     },
// }));

function isDuplicateMessage(newMessage, existingMessages) {
    return newMessage.id !== null &&
        existingMessages.some(message => newMessage.id === message.id);
}

class Messages extends Component {
    constructor(props) {
        super(props);
        this.state = {
            usernameColors: {},
            refreshing: false
        };

        this.renderItem = this.renderItem.bind(this);
        this.send = this.send.bind(this);
        this.onEndReached = this.onEndReached.bind(this);
    }

    static navigationOptions = ({ navigation }) => {
        const { state, navigate } = navigation;

        const goToGroupDetails = navigate.bind(this, 'GroupDetails', {
            id: state.params.groupId,
            title: state.params.title,
        });

        return {
            headerTitle: (
                <TouchableOpacity
                    style={styles.titleWrapper}
                    onPress={goToGroupDetails}
                >
                    <View style={styles.title}>
                        <Image
                            style={styles.titleImage}
                            source={{ uri: 'https://facebook.github.io/react/img/logo_og.png' }}
                        />
                        <Text>{state.params.title}</Text>
                    </View>
                </TouchableOpacity>
            ),
        }
    };



    componentWillReceiveProps(nextProps) {
        const usernameColors = {};
        // check for new messages
        if (nextProps.group) {
            if (nextProps.group.users) {
                // apply a color to each user
                nextProps.group.users.forEach((user) => {
                    usernameColors[user.username] = this.state.usernameColors[user.username] || randomColor();
                });
            }
            this.setState({
                usernameColors,
            });
        }
    }

    keyExtractor = item => item.node.id.toString();

    renderItem = ({ item: edge }) => {
        const message = edge.node;
        return (
            <Message
                color={this.state.usernameColors[message.from.username]}
                isCurrentUser={message.from.id === 1} // for now until we implement auth
                message={message}
            />
        );
    };

    onEndReached() {
        if (!this.state.loadingMoreEntries &&
            this.props.group.messages.pageInfo.hasNextPage) {
            this.setState({
                loadingMoreEntries: true,
            });
            this.props.loadMoreEntries().then(() => {
                this.setState({
                    loadingMoreEntries: false,
                });
            });
        }
    }

    send(text) {
        this.props.createMessage({
            groupId: this.props.navigation.state.params.groupId,
            userId: 1, // faking the user for now
            text,
        }).then(() => {
            this.flatList.scrollToIndex({ index: 0, animated: true });
        });
    };

    render() {
        const { loading, group } = this.props;
        // render loading placeholder while we fetch messages
        if (loading || !group) {
            return (
                <View style={[styles.loading, styles.container]}>
                    <ActivityIndicator />
                </View>
            );
        }
        // render list of messages for group
        return (
            <View style={styles.container}>
                <FlatList
                    inverted
                    data={group.messages.edges}
                    ref={(ref) => { this.flatList = ref; }}
                    keyExtractor={this.keyExtractor}
                    renderItem={this.renderItem}
                    onEndReached={this.onEndReached}
                />
                <MessageInput send={this.send} />
            </View>
        );
    }
}

Messages.propTypes = {
    createMessage: PropTypes.func,
    navigation: PropTypes.shape({
        navigate: PropTypes.func,
        state: PropTypes.shape({
            params: PropTypes.shape({
                groupId: PropTypes.number,
            }),
        }),
    }),
    group: PropTypes.shape({
        messages: PropTypes.shape({
            edges: PropTypes.arrayOf(PropTypes.shape({
                cursor: PropTypes.string,
                node: PropTypes.object,
            })),
            pageInfo: PropTypes.shape({
                hasNextPage: PropTypes.bool,
                hasPreviousPage: PropTypes.bool,
            }),
        }),
        users: PropTypes.array,
    }),
    loading: PropTypes.bool,
    loadMoreEntries: PropTypes.func,
};

const ITEMS_PER_PAGE = 10;
const groupQuery = graphql(GROUP_QUERY, {
    options: ownProps => ({
        variables: {
            groupId: ownProps.navigation.state.params.groupId,
            first: ITEMS_PER_PAGE,
        },
    }),
    props: ({ data: { fetchMore, loading, group } }) => ({
        loading,
        group,
        loadMoreEntries() {
            return fetchMore({
                // query: ... (you can specify a different query.
                // GROUP_QUERY is used by default)
                variables: {
                    // load more queries starting from the cursor of the last (oldest) message
                    after: group.messages.edges[group.messages.edges.length - 1].cursor,
                },
                updateQuery: (previousResult, { fetchMoreResult }) => {
                    // we will make an extra call to check if no more entries
                    if (!fetchMoreResult) { return previousResult; }
                    // push results (older messages) to end of messages list
                    return update(previousResult, {
                        group: {
                            messages: {
                                edges: { $push: fetchMoreResult.group.messages.edges },
                                pageInfo: { $set: fetchMoreResult.group.messages.pageInfo },
                            },
                        },
                    });
                },
            });
        },
    }),
});

const createMessageMutation = graphql(CREATE_MESSAGE_MUTATION, {
    props: ({ mutate }) => ({
        createMessage: ({ text, userId, groupId }) =>
            mutate({
                variables: { text, userId, groupId },
                optimisticResponse: {
                    __typename: 'Mutation',
                    createMessage: {
                        __typename: 'Message',
                        id: -1, // don't know id yet, but it doesn't matter
                        text, // we know what the text will be
                        createdAt: new Date().toISOString(), // the time is now!
                        from: {
                            __typename: 'User',
                            id: 1, // still faking the user
                            username: 'Justyn.Kautzer', // still faking the user
                        },
                        to: {
                            __typename: 'Group',
                            id: groupId,
                            first: ITEMS_PER_PAGE,
                        },
                    },
                },
                update: (store, { data: { createMessage } }) => {
                    // Read the data from our cache for this query.
                    const data = store.readQuery({
                        query: GROUP_QUERY,
                        variables: {
                            groupId,
                        },
                    });
                    if (isDuplicateMessage(createMessage, data.group.messages)) {
                        return data;
                    }
                    // Add our message from the mutation to the end.
                    data.group.messages.edges.unshift({
                        __typename: 'MessageEdge',
                        node: createMessage,
                        cursor: Buffer.from(createMessage.id.toString()).toString('base64'),
                    });
                    // Write our data back to the cache.
                    store.writeQuery({
                        query: GROUP_QUERY,
                        variables: {
                            groupId,
                            first: ITEMS_PER_PAGE,
                        },
                        data,
                    });
                },
            }),
    }),
});

export default compose(
    groupQuery,
    createMessageMutation,
)(Messages);