import Database from "@tauri-apps/plugin-sql";

let instance: Database | null = null;

export async function getDb(): Promise<Database> {
	if (instance === null) {
		instance = await Database.load("sqlite:movies.db");
	}
	return instance;
}
