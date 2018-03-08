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
        };
        this.send = this.send.bind(this);
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

    keyExtractor = item => item.id;

    renderItem = ({ item: message }) => (
        <Message
            color={this.state.usernameColors[message.from.username]}
            isCurrentUser={message.from.id === 1} // for now until we implement auth
            message={message}
        />
    );

    send(text) {
        this.props.createMessage({
            groupId: this.props.navigation.state.params.groupId,
            userId: 1, // faking the user for now
            text,
        }).then(() => {
            this.flatList.scrollToEnd({ animated: true });
        });
    };

    render() {
        const { loading, group } = this.props;
        // render loading placeholder while we fetch messages
        if (loading && !group) {
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
                    data={group.messages.slice().reverse()}
                    ref={(ref) => { this.flatList = ref; }}
                    keyExtractor={this.keyExtractor}
                    renderItem={this.renderItem}
                />
                <MessageInput send={this.send} />
            </View>
        );
    }
}

Messages.propTypes = {
    createMessage: PropTypes.func,
    navigation: PropTypes.shape({
        state: PropTypes.shape({
            params: PropTypes.shape({
                groupId: PropTypes.number,
            }),
        }),
    }),
    group: PropTypes.shape({
        messages: PropTypes.array,
        users: PropTypes.array,
    }),
    loading: PropTypes.bool,
};

const groupQuery = graphql(GROUP_QUERY, {
    options: ownProps => ({
        variables: {
            groupId: ownProps.navigation.state.params.groupId,
        },
    }),
    props: ({ data: { loading, group, error  } }) => {
        if(error) {
            console.log("GQL Err:", error);
        }
        return {loading, group};
    },
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
                    data.group.messages.unshift(createMessage);
                    // Write our data back to the cache.
                    store.writeQuery({
                        query: GROUP_QUERY,
                        variables: {
                            groupId,
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