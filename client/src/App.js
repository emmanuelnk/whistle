/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */
// const ip = require('ip');
import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ApolloProvider } from 'react-apollo';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import ApolloClient, { createNetworkInterface } from 'react-apollo';
import AppWithNavigationState, { navigationReducer } from './navigation';

const networkInterface = createNetworkInterface({ uri: `http://10.0.2.2:8080/graphql` });
const client = new ApolloClient({
    networkInterface,
});

// Redux Store
const store = createStore(
    combineReducers({
        apollo: client.reducer(),
        nav: navigationReducer
    }),
    {}, // initial state
    composeWithDevTools(
        applyMiddleware(client.middleware()),
    ),
);

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' +
    'Cmd+D or shake for dev menu',
  android: 'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

export default class App extends Component {
    render() {
        return (
            <ApolloProvider store={store} client={client}>
                <AppWithNavigationState />
            </ApolloProvider>
        );
    }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});
