import * as sqlite3 from "sqlite3";
import {v4 as uuidv4} from "uuid";
import {join} from "path";

interface ChatHistory {
    chat_id: string;
    user_id: string;
    last_updated: number;
    chat_name: string;
    model: string;
    messages: string;
}

const createTableIfNotExists = async (db: sqlite3.Database): Promise<void> => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS chat_history (
      chat_id TEXT PRIMARY KEY,
      user_id TEXT,
      last_updated INTEGER,
      chat_name TEXT,
      model TEXT,
      messages TEXT
    );
  `;

    return new Promise((resolve, reject) => {
        db.run(createTableQuery, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

const insertChatHistory = async (db: sqlite3.Database, data: ChatHistory): Promise<void> => {
    const insertQuery = `
    INSERT INTO chat_history (chat_id, user_id, last_updated, chat_name, model, messages)
    VALUES ($chat_id, $user_id, $last_updated, $chat_name, $model, $messages);
  `;

    const {chat_id, user_id, last_updated, chat_name, model, messages} = data;

    return new Promise((resolve, reject) => {
        db.run(
            insertQuery,
            {$chat_id: chat_id, $user_id: user_id, $last_updated: last_updated, $chat_name: chat_name, $model: model, $messages: messages},
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

const storeChatHistory = async (chat_name: string, model: string, messages: string): Promise<void> => {
    const dbPath = join(__dirname, "..", ".cache", "chat_history.db");
    const db = new sqlite3.Database(dbPath);

    try {
        await createTableIfNotExists(db);

        const data: ChatHistory = {
            chat_id: uuidv4(),
            user_id: uuidv4(),
            last_updated: Math.floor(Date.now() / 1000),
            chat_name,
            model,
            messages,
        };

        await insertChatHistory(db, data);
    } finally {
        db.close();
    }
};

// Example usage:
storeChatHistory("Test Chat", "Test Model", JSON.stringify([{message: "Hello!"}])).catch((err) =>
    console.error("Error storing chat history:", err)
);

