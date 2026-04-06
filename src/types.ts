export type GitHubTeam = "backend" | "frontend";
export type AwsAccount = "dev" | "prod";
export type UserRole = "engineer" | "lead";

export interface UserConfig {
    name: string;
    email: string;
    github_team: GitHubTeam;
    aws_account: AwsAccount;
    aws_groups: string[];
    role: UserRole;
}

export interface UsersFile {
    users: UserConfig[];
}

export interface GitHubOutputs {
    userId: string;
    teamId: string;
}

export interface AwsOutputs {
    userId: string;
    userArn: string;
}