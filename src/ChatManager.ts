import type {Database} from "sqlite";
import {open} from "sqlite";
import {Database as DriverDatabase} from "sqlite3";
import {v4 as uuidv4} from "uuid";
import {getUnixTimestamp} from "./utils";

// TODO: contact support about model compatibility
// TODO: hardcode model compatibility for now
// TODO: move ServiceID to static config mapping them to API endpoints and commands
// TODO: use zod, or a sqlite orm

// NOTE: these default values will be retrived from a config file later, they are temporary while the service is being worked on
const DEFAULT_CHAT_NAME = "Untitled Chat";
// TODO: pull in the default model as a config value for ChatManager

const DEFAULT_SERVICE_INFO: ServiceInfo = {
    modelID: "gpt-4o",
    service: "openai-chat-completion",
}

export type ChatID = string;
export type UserID = string;
export type ModelID = string;
export type ServiceID = "openai-chat-completion" | "openai-completion" | "openai-edit" | "openai-code-completion" | "openai-image";
export type Message = {role: string; content: string};

export interface UserContext {
    userID: UserID;
    activeChatID: ChatID;
    isPaused: boolean;
}
type UserContextInDB = Omit<UserContext, "isPaused"> & {isPaused: number};

function convertUserContextFromDB(userContext: UserContextInDB): UserContext {
    return {
        ...userContext,
        isPaused: userContext.isPaused === 1,
    };
}

export interface ServiceInfo {
    modelID: ModelID;
    service: ServiceID;
}

export interface Chat {
    chatID: ChatID;
    userID: UserID;
    lastUpdated: number;
    chatName: string;
    serviceInfo: ServiceInfo;
    messages: Message[];
}
// Omit both serviceInfo and messages from ChatInDB:
type ChatInDB = Omit<Chat, "messages" | "serviceInfo"> & {serviceInfo: string, messages: string};
function convertChatFromDB(chatFromDB: ChatInDB): Chat {
    return {
        ...chatFromDB,
        serviceInfo: JSON.parse(chatFromDB.serviceInfo),
        messages: JSON.parse(chatFromDB.messages),
    };
}

export interface ChatLoadError {
    errorType: "chat-load-error";
    message: string;
}

export default class ChatManager {
    private constructor(private db: Database) {}

    static async initialize(db: Database): Promise<ChatManager> {
        await db.run(`CREATE TABLE IF NOT EXISTS chatHistory (
      chatID TEXT PRIMARY KEY,
      userID TEXT,
      lastUpdated INTEGER,
      chatName TEXT,
      serviceInfo TEXT,
      messages TEXT
    )`);

        await db.run(`CREATE TABLE IF NOT EXISTS userContext (
      userID TEXT PRIMARY KEY,
      activeChatID TEXT,
      isPaused INTEGER
    )`);

        return new ChatManager(db);

    }

    static async loadFromSQLiteFile(filename: string): Promise<ChatManager> {
        const db = await open({filename, driver: DriverDatabase});

        const chatManager = await ChatManager.initialize(db);
        return chatManager;
    }

    async shutdown() {
        await this.db.close();
    }

    async new(userID: string, chatName: string = DEFAULT_CHAT_NAME, system?: string): Promise<Chat> {
        const chatID = uuidv4();
        const messages = system
            ? [{role: "system", content: system}]
            : [];

        const lastUpdated = getUnixTimestamp();
        const serviceInfo = DEFAULT_SERVICE_INFO;

        // Change this to a private function that takes a chat object
        const chat: Chat = {
            chatID,
            userID,
            lastUpdated,
            chatName,
            serviceInfo,
            messages,
        };

        await this.saveChat(chat);

        const userContext: UserContext = {
            userID,
            activeChatID: chatID,
            isPaused: false,
        };
        await this.saveUserContext(userContext);

        return {
            chatID,
            userID,
            lastUpdated,
            serviceInfo,
            chatName,
            messages,
        }
    }

    async delete(userID: string, chatID?: ChatID) {
        if (chatID) {
            await this.db.run("DELETE FROM chatHistory WHERE chatID = ? AND userID = ?", chatID, userID);
        } else {
            const activeChat = await this.getActiveChatID(userID);
            if (activeChat) {
                await this.db.run(
                    "DELETE FROM chatHistory WHERE chatID = ? AND userID = ?",
                    activeChat,
                    userID
                );
            }
        }

        // Activate the next most recent chat, or create and activate one if it doesn't exist
        const nextChat = await this.db.get<ChatInDB>(
            "SELECT chatID FROM chatHistory WHERE userID = ? ORDER BY lastUpdated DESC LIMIT 1",
            userID
        );

        if (nextChat) {
            await this.db.run("UPDATE userContext SET activeChatID = ? WHERE userID = ?", nextChat.chatID, userID);
        } else {
            await this.new(userID);
        }
    }

    async list(userID: string, filter?: string): Promise<Chat[]> {
        let query: string;
        if (filter !== undefined) {
            query = `SELECT * FROM chatHistory WHERE userID = ? AND chatName LIKE ?`;
        } else {
            query = `SELECT * FROM chatHistory WHERE userID = ?`;
        }
        const chats = await this.db.all<ChatInDB[]>(query, userID, filter);

        return chats.map(convertChatFromDB);
    }

    async saveChat(chat: Chat) {
        await this.db.run(
            // Upsert
            "INSERT OR REPLACE INTO chatHistory (chatID, userID, lastUpdated, chatName, serviceInfo, messages) VALUES (?, ?, ?, ?, ?, ?)",
            chat.chatID,
            chat.userID,
            chat.lastUpdated,
            chat.chatName,
            JSON.stringify(chat.serviceInfo),
            JSON.stringify(chat.messages),
        );
    }


    async saveUserContext(userContext: UserContext) {
        // Upsert
        await this.db.run(
            "INSERT OR REPLACE INTO userContext (userID, activeChatID, isPaused) VALUES (?, ?, ?)",
            userContext.userID,
            userContext.activeChatID,
            userContext.isPaused ? 1 : 0,
        );
    }

    async clear(userID: string, chatID?: ChatID) {
        if (chatID) {
            await this.db.run("UPDATE chatHistory SET messages = ? WHERE chatID = ? AND userID = ?", JSON.stringify([]), chatID, userID);
        } else {
            const activeChat = await this.getActiveChatID(userID);
            if (activeChat) {
                await this.db.run("UPDATE chatHistory SET messages = ? WHERE chatID = ? AND userID = ?", JSON.stringify([]), activeChat, userID);
            }
        }
    }

    async pop(userID: string, chatID?: ChatID) {
        if (chatID) {
            const chat = await this.db.get<ChatInDB>("SELECT messages FROM chatHistory WHERE chatID = ? AND userID = ?", chatID, userID);
            if (chat) {
                const messages = JSON.parse(chat.messages);
                messages.pop();
                await this.db.run("UPDATE chatHistory SET messages = ? WHERE chatID = ? AND userID = ?", JSON.stringify(messages), chatID, userID);
            }
        } else {
            const activeChatID = await this.getActiveChatID(userID);
            const activeChat = await this.db.get<ChatInDB>("SELECT messages FROM chatHistory WHERE chatID = ?", activeChatID);
            if (activeChat) {
                const messages = JSON.parse(activeChat.messages);
                messages.pop();
                await this.db.run("UPDATE chatHistory SET messages = ? WHERE chatID = ? AND userID = ?", JSON.stringify(messages), activeChatID, userID);
            }
        }
    }

    async pause(userID: string) {
        this.modifyPaused(userID, true);
    }

    async unpause(userID: string) {
        this.modifyPaused(userID, false);
    }

    private async modifyPaused(userID: string, shouldPause: boolean) {
        await this.db.run("INSERT OR REPLACE INTO userContext (userID, isPaused) VALUES (?, ?)", userID, shouldPause ? 1 : 0);
    }

    async isPaused(userID: string) {
        const userContext = await this.getUserContext(userID);
        return userContext.isPaused;
    }

    async setModel(userID: string, model: string, givenChatID?: ChatID): Promise<true | ChatLoadError> {
        const chatID: ChatID = givenChatID ?? (await this.getActiveChatID(userID));
        // Get the chat, get the serviceInfo, set the model, save the chat
        const chat = await this.getChatForUser(userID, chatID);

        if ("errorType" in chat) {
            return chat;
        }

        chat.serviceInfo.modelID = model;

        await this.saveChat(chat);
        return true;
    }

    // NOTE: these are OpenAI-specific right now
    async addAnswer(userID: string, ans: string) {
        await this.addMessageToActiveChat(userID, {role: "assistant", content: ans});
    }

    async addSystemMessage(userID: string, sys: string) {
        await this.addMessageToActiveChat(userID, {role: "system", content: sys});
    }

    async addUserMessage(userID: string, str: string) {
        await this.addMessageToActiveChat(userID, {role: "user", content: str});
    }

    async getUserContext(userID: string): Promise<UserContext> {
        const userContextFromDB = await this.db.get<UserContextInDB>("SELECT * FROM userContext WHERE userID = ?", userID);
        if (!userContextFromDB) {
            return this.createUserContext(userID);
        }

        return convertUserContextFromDB(userContextFromDB);
    }

    private async createUserContext(userID: string): Promise<UserContext> {
        // If the user has any chats already, set the active chat to the most recent one
        // Otherwise, create a new chat and set it as the active chat
        const activeChat = await this.db.get<ChatInDB>("SELECT * FROM chatHistory WHERE userID = ?", userID);
        let activeChatID: ChatID;
        if (activeChat) {
            activeChatID = activeChat.chatID;
        } else {
            activeChatID = (await this.new(userID)).chatID;
        }

        const userContext = {userID, activeChatID, isPaused: false};
        this.saveUserContext(userContext);

        return userContext;
    }

    async activateChat(userID: string, chatID: ChatID): Promise<true | ChatLoadError> {
        const chat = await this.getChatForUser(userID, chatID);
        if ("errorType" in chat) {
            return chat;
        }

        await this.saveUserContext({userID, activeChatID: chatID, isPaused: false});
        return true;
    }

    async getChatForUser(userID: string, givenChatID?: ChatID): Promise<Chat | ChatLoadError> {
        if (givenChatID) {
            // Load the given chat, or error if the chat doesn't exist
            const possiblyChatFromDB = await this.db.get<ChatInDB>("SELECT * FROM chatHistory WHERE chatID = ? AND userID = ?", givenChatID, userID);

            if (!possiblyChatFromDB) {
                return {
                    errorType: "chat-load-error",
                    message: `Chat ${givenChatID} does not exist for user ${userID}`,
                };
            }
            return convertChatFromDB(possiblyChatFromDB);
        } else {
            return await this.getActiveChat(userID);
        }
    }

    async getActiveChat(userID: string): Promise<Chat> {
        const userContext = await this.getUserContext(userID);
        const activeChatID = userContext.activeChatID;
        // We trust "getUserContext" to have ensured that the active chat exists
        const chat = await this.db.get<ChatInDB>("SELECT * FROM chatHistory WHERE chatID = ? AND userID = ?", activeChatID, userID);
        return convertChatFromDB(chat!);
    }

    private async getActiveChatID(userID: string): Promise<ChatID> {
        return (await this.getActiveChat(userID)).chatID;
    }

    private async addMessageToActiveChat(userID: string, message: Message) {
        const activeChatID = await this.getActiveChatID(userID);
        const activeChat = await this.db.get<ChatInDB>("SELECT messages FROM chatHistory WHERE chatID = ?", activeChatID);
        if (activeChat) {
            const messages = JSON.parse(activeChat.messages);
            messages.push(message);
            await this.db.run("UPDATE chatHistory SET messages = ? WHERE chatID = ? AND userID = ?", JSON.stringify(messages), activeChatID, userID);
        }
    }
}
