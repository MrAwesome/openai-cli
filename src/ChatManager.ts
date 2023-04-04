type ChatID = string;
type UserID = string;

export interface ChatCompletionRequestMessage {
    /**
     * The role of the author of this message.
     * @type {string}
     * @memberof ChatCompletionRequestMessage
     */
    'role': ChatCompletionRequestMessageRoleEnum;
    /**
     * The contents of the message
     * @type {string}
     * @memberof ChatCompletionRequestMessage
     */
    'content': string;
    /**
     * The name of the user in a multi-user chat
     * @type {string}
     * @memberof ChatCompletionRequestMessage
     */  
    'name'?: string;
}
export declare const ChatCompletionRequestMessageRoleEnum: {
    readonly System: "system";
    readonly User: "user";
    readonly Assistant: "assistant";
};
export declare type ChatCompletionRequestMessageRoleEnum = typeof ChatCompletionRequestMessageRoleEnum[keyof typeof ChatCompletionRequestMessageRoleEnum];

// Support multiple system messages...

type UserChats = Record<UserID, ChatID[]>;


export default class ChatManager {
    private chatID: ChatID = "default";
    private system: string;
    private chats: Record<ChatID, any>;

    constructor() {
        this.chats = {};
    }

    public new(user: UserID, chatID?: ChatID, system?: string): ChatID {
        if (!chatID) {
            chatID = this.generateChatID();
        }

        if (!system) {
            system = this.system || "default";
        }

        this.chats[chatID] = { system, conversations: [] };
        return chatID;
    }

    public delete(chatID?: ChatID): void {
        if (chatID) {
            delete this.chats[chatID];
        } else {
            delete this.chats[this.chatID];
        }
    }

    public list(filter?: string): ChatID[] {
        const chatIDs = Object.keys(this.chats);
        if (filter) {
            return chatIDs.filter((id) => this.chats[id].system === filter);
        }
        return chatIDs;
    }

    public select(chatID: ChatID): void {
        if (this.chats[chatID]) {
            this.chatID = chatID;
        } else {
            throw new Error("ChatID not found");
        }
    }

    public save(chatID: ChatID): void {
        // Implement save functionality for chat with given chatID.
    }

    public clear(chatID?: ChatID): void {
        if (chatID) {
            this.chats[chatID].conversations = [];
        } else {
            this.chats[this.chatID].conversations = [];
        }
    }

    public pop(chatID?: ChatID): void {
        if (chatID) {
            this.chats[chatID].conversations.pop();
        } else {
            this.chats[this.chatID].conversations.pop();
        }
    }

    public pause(): void {
        // Implement pause functionality.
    }

    public answer(ans: string): void {
        // Implement answer functionality.
    }

    public ask(question: string): void {
        // Implement ask functionality.
    }

    public system(system?: string): string {
        if (system) {
            this.system = system;
        }
        return this.system;
    }

    private generateChatID(): ChatID {
        return Math.random().toString(36).substring(2, 10);
    }
}

