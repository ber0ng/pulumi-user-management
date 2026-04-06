import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { UsersFile, UserConfig } from "../types";

// Helper to load the real config file
function loadFixture(): UserConfig[] {
    const raw = fs.readFileSync(
        path.resolve(__dirname, "../../config/users.yaml"),
        "utf8"
    );
    return (yaml.load(raw) as UsersFile).users;
}

describe("users.yaml config", () => {
    let users: UserConfig[];

    beforeAll(() => {
        users = loadFixture();
    });

    test("loads at least one user", () => {
        expect(users.length).toBeGreaterThan(0);
    });

    test("all users have required fields", () => {
        for (const u of users) {
            expect(u.name).toBeTruthy();
            expect(u.email).toMatch(/@/);
            expect(["backend", "frontend"]).toContain(u.github_team);
            expect(["dev", "prod"]).toContain(u.aws_account);
        }
    });

    test("no duplicate user names", () => {
        const names = users.map((u) => u.name);
        expect(new Set(names).size).toBe(names.length);
    });

    test("aws_groups is an array when present", () => {
        for (const u of users) {
            if (u.aws_groups !== undefined) {
                expect(Array.isArray(u.aws_groups)).toBe(true);
            }
        }
    });
});

describe("naming conventions", () => {
    test("user names are lowercase alphanumeric", () => {
        const users = loadFixture();
        for (const u of users) {
            expect(u.name).toMatch(/^[a-z0-9-]+$/);
        }
    });
});