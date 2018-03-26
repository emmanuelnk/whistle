import { Group, Message, User } from './connectors';
import {Buffer} from 'buffer';

function testMessages (group, { first, last, before, after }) {
    const where = { groupId: group.id };

    if (before) {
        // convert base-64 to utf8 id
        where.id = { $gt: Buffer.from(before, 'base64').toString() };
    }
    if (after) {
        where.id = { $lt: Buffer.from(after, 'base64').toString() };
    }

    return Message.findAll({
        where,
        order: [['id', 'DESC']],
        limit: first || last,
    }).then((messages) => {
        const edges = messages.map(message => ({
            cursor: Buffer.from(message.id.toString()).toString('base64'), // convert id to cursor
            node: message, // the node is the message itself
        }));
        console.log('edges', edges);
        return {
            edges,
            pageInfo: {
                hasNextPage() {
                    if (messages.length < (last || first)) {
                        return Promise.resolve(false);
                    }
                    return Message.findOne({
                        where: {
                            groupId: group.id,
                            id: {
                                [before ? '$gt' : '$lt']: messages[messages.length - 1].id,
                            },
                        },
                        order: [['id', 'DESC']],
                    }).then((message) => {
                        console.log('message', message);
                        return !!message;
                    });
                },
                hasPreviousPage() {
                    return Message.findOne({
                        where: {
                            groupId: group.id,
                            id: where.id,
                        },
                        order: [['id']],
                    }).then((message) => {
                        console.log('message', message);
                        return !!message;
                    });
                },
            },
        };
    });
}

console.log(testMessages({id:1},{ first: 2, after: "MjI=" }));
