import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { UsersFile, UserConfig } from "./types";

export function loadUsers(): UserConfig[] {
    const filePath = path.resolve(__dirname, "config/users.yaml");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = yaml.load(raw) as UsersFile;

    if (!parsed?.users || !Array.isArray(parsed.users)) {
        throw new Error("Invalid users.yaml: missing 'users' array");
    }

    parsed.users.forEach(validateUser);
    return parsed.users;
}

function validateUser(u: UserConfig): void {
    const required = ["name", "email", "github_team", "aws_account"] as const;
    for (const field of required) {
        if (!u[field]) throw new Error(`User missing required field: ${field}`);
    }

    const validTeams = ["backend", "frontend"];
    if (!validTeams.includes(u.github_team)) {
        throw new Error(`User ${u.name}: invalid github_team '${u.github_team}'`);
    }

    const validAccounts = ["dev", "prod"];
    if (!validAccounts.includes(u.aws_account)) {
        throw new Error(`User ${u.name}: invalid aws_account '${u.aws_account}'`);
    }
}