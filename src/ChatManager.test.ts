import ChatManager, {Chat, Message} from "./ChatManager";
import {v4 as uuidv4} from "uuid";

describe("ChatManager", () => {
    let chatManager: ChatManager;

    beforeAll(async () => {
        chatManager = await ChatManager.loadFromSQLiteFile(":memory:");
    });

    afterAll(async () => {
        await chatManager.shutdown();
    });

    describe("new chat, save, and load", () => {
        it("should create, save and load a new chat", async () => {
            const userID = uuidv4();
            const chatName = "Test chat";
            const system = "System message";

            // Create a new chat
            const chat = await chatManager.new(userID, chatName, system);

            expect(chat.userID).toEqual(userID);
            expect(chat.chatName).toEqual(chatName);
            expect(chat.messages).toHaveLength(1);
            expect(chat.messages[0]).toEqual({role: "system", content: system});

            // Save and load the chat
            const newMessage: Message = {role: "assistant", content: "New message"};
            chat.messages.push(newMessage);
            await chatManager.saveChat(chat);

            const loadedChat = await chatManager.getChatForUser(userID, chat.chatID);
            if ("errorType" in loadedChat) {
                throw new Error("Chat not loaded");
            }

            expect(loadedChat.messages).toHaveLength(2);
            expect(loadedChat.messages).toContainEqual(newMessage);
        });
    });

    describe("adding messages and clearing chat", () => {
        it("should add and save messages, then clear the chat", async () => {
            const userID = uuidv4();
            await chatManager.new(userID);

            const userMessage = "User message";
            const systemMessage = "System message";
            const assistantMessage = "Assistant message";

            // Add messages
            await chatManager.addUserMessage(userID, userMessage);
            await chatManager.addSystemMessage(userID, systemMessage);
            await chatManager.addAnswer(userID, assistantMessage);

            // Check if messages are added
            const chatOrError = await chatManager.getChatForUser(userID);
            if ("errorType" in chatOrError) {
                throw new Error("Chat not loaded");
            }
            const savedChat = chatOrError as Chat;
            expect(savedChat.messages).toHaveLength(3);
            expect(savedChat.messages).toContainEqual({role: "user", content: userMessage});
            expect(savedChat.messages).toContainEqual({role: "system", content: systemMessage});
            expect(savedChat.messages).toContainEqual({role: "assistant", content: assistantMessage});

            // Clear the chat
            await chatManager.clear(userID);

            // Check if chat is cleared
            const clearedChat = await chatManager.getChatForUser(userID) as Chat;
            expect(clearedChat.messages).toHaveLength(0);
        });
    });

    describe("listing chats and deleting chat", () => {
        it("should list chats and delete a chat", async () => {
            const userID = uuidv4();

            // Create new chats
            const chat1 = await chatManager.new(userID, "Test chat 1");
            const chat2 = await chatManager.new(userID, "Test chat 2");
            const chat3 = await chatManager.new(userID, "Test chat 3");

            // Check if chats are listed
            const listedChats = await chatManager.list(userID);
            expect(listedChats).toHaveLength(3);
            expect(listedChats.map(chat => chat.chatID)).toContain(chat1.chatID);
            expect(listedChats.map(chat => chat.chatID)).toContain(chat2.chatID);
            expect(listedChats.map(chat => chat.chatID)).toContain(chat3.chatID);

            // Delete a chat
            await chatManager.delete(userID, chat1.chatID);

            // Check if chat is deleted
            const updatedList = await chatManager.list(userID);
            expect(updatedList).toHaveLength(2);
            expect(updatedList.map(chat => chat.chatID)).not.toContain(chat1.chatID);
        });
    });

    describe("pausing and unpausing chats", () => {
        it("should pause and unpause chats", async () => {
            const userID = uuidv4();
            await chatManager.new(userID);

            // Check if chat is not paused initially
            let isPaused = await chatManager.isPaused(userID);
            expect(isPaused).toBeFalsy();

            // Pause chat
            await chatManager.pause(userID);

            // Check if chat is paused
            isPaused = await chatManager.isPaused(userID);
            expect(isPaused).toBeTruthy();

            // Unpause chat
            await chatManager.unpause(userID);

            // Check if chat is unpaused
            isPaused = await chatManager.isPaused(userID);
            expect(isPaused).toBeFalsy();
        });
    });

    describe("pop and set model", () => {
        it("should pop the last message and set the chat model", async () => {
            const userID = uuidv4();
            await chatManager.new(userID);

            // Add messages
            await chatManager.addUserMessage(userID, "User message 1");
            await chatManager.addUserMessage(userID, "User message 2");

            // Pop the last message
            await chatManager.pop(userID);

            // Check if the last message is removed
            const chat = await chatManager.getChatForUser(userID) as Chat;
            expect(chat.messages).toHaveLength(1);
            expect(chat.messages).not.toContainEqual({role: "user", content: "User message 2"});

            // Set the chat model
            await chatManager.setModel(userID, "new-model");

            // Check if the model is set
            const updatedChat = await chatManager.getChatForUser(userID) as Chat;
            expect(updatedChat.serviceInfo.modelID).toEqual("new-model");
        });
    });

    describe("activating chats", () => {
        it("should activate a chat and switch between active chats", async () => {
            const userID = uuidv4();

            // Create new chats
            const chat1 = await chatManager.new(userID, "Test chat 1");
            const chat2 = await chatManager.new(userID, "Test chat 2");

            // Get the active chat
            const activeChat1 = await chatManager.getActiveChat(userID);

            // Ensure the active chat is set correctly
            expect(activeChat1.chatID).toEqual(chat2.chatID);

            // Activate another chat
            const activationResult = await chatManager.activateChat(userID, chat1.chatID);
            expect(activationResult).toBe(true);

            // Get the new active chat
            const activeChat2 = await chatManager.getActiveChat(userID);

            // Ensure the active chat has changed
            expect(activeChat2.chatID).toEqual(chat1.chatID);
        });
    });

    describe("errors while handling chats", () => {
        it("should return chat load errors", async () => {
            const userID = uuidv4();
            const nonExistingChatID = uuidv4();

            // Activate non-existing chat
            const activationResult = await chatManager.activateChat(userID, nonExistingChatID);
            expect(activationResult).toEqual({errorType: "chat-load-error", message: `Chat ${nonExistingChatID} does not exist for user ${userID}`});

            // Get non-existing chat
            const chatLoadResult = await chatManager.getChatForUser(userID, nonExistingChatID);
            expect(chatLoadResult).toEqual({errorType: "chat-load-error", message: `Chat ${nonExistingChatID} does not exist for user ${userID}`});

            // Set model for non-existing chat
            const setModelResult = await chatManager.setModel(userID, "new-model", nonExistingChatID);
            expect(setModelResult).toEqual({errorType: "chat-load-error", message: `Chat ${nonExistingChatID} does not exist for user ${userID}`});
        });
    });

    describe("listing chats with filter", () => {
        it("should list chats filtered by chat name", async () => {
            const userID = uuidv4();
            const filter = "%iltered%";

            // Create new chats
            await chatManager.new(userID, "Test chat 1");
            await chatManager.new(userID, "Test chat 2");
            await chatManager.new(userID, "Filtered chat 1");
            await chatManager.new(userID, "Filtered chat 2");

            // List chats with filter
            const filteredChats = await chatManager.list(userID, filter);

            // Check if the list only contains chats that match the filter
            expect(filteredChats).toHaveLength(2);
            expect(filteredChats.every(chat => chat.chatName.startsWith("Filtered"))).toBeTruthy();
        });
    });
});
