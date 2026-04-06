import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import { loadUsers } from "./config";
import { createGitHubTeams, GitHubUserComponent } from "./github/githubUserComponents";
import { createAwsGroups, AwsUserComponent } from "./aws/awsUserComponents";
import { createGitHubOidcRole } from "./aws/githubOidcRole";

// Config
const cfg = new pulumi.Config();
const githubOrg = cfg.require("githubOrg");
const githubCfg = new pulumi.Config("github");

// GitHub provider
const githubProvider = new github.Provider("github-provider", {
    owner: githubOrg,
    token: githubCfg.requireSecret("token"),
});

// Load users from config/users.yaml
const users = loadUsers();

// GitHub teams
const ghTeams = createGitHubTeams(githubOrg, githubProvider);

users.forEach(u => new GitHubUserComponent(u, ghTeams, { provider: githubProvider }));

// AWS IAM groups
const awsGroups = createAwsGroups();

// ── GitHub Actions OIDC Role ──────────────────────────────────────────────────
const githubActionsRole = createGitHubOidcRole({
    repoPath: cfg.require("githubActionsRepo"),
    policyStatements: [
        {
            Effect: "Allow",
            Action: [
                "iam:CreateUser", "iam:DeleteUser", "iam:GetUser", "iam:UpdateUser",
                "iam:CreateAccessKey", "iam:DeleteAccessKey", "iam:ListAccessKeys",
                "iam:AddUserToGroup", "iam:RemoveUserFromGroup", "iam:GetGroup",
                "iam:CreateGroup", "iam:DeleteGroup",
                "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:ListPolicyVersions",
                "iam:AttachGroupPolicy", "iam:DetachGroupPolicy",
                "iam:TagUser", "iam:UntagUser", "iam:ListGroupsForUser",
                "iam:GetRole", "sts:GetCallerIdentity",
            ],
            Resource: "*",
        },
    ],
});

const awsUsers = users.map(
    (u) => new AwsUserComponent(u, awsGroups)
);

// Export outputs 
export const githubTeams = {
    backend: ghTeams.backend.id,
    frontend: ghTeams.frontend.id,
};

export const githubActionsRoleArn = githubActionsRole.roleArn;

export const iamUsers = users.reduce((acc, u, i) => {
    acc[u.name] = {
        arn: awsUsers[i].user.arn,
        // Access key secret — marked as secret so Pulumi encrypts it in state
        accessKeyId: awsUsers[i].accessKey.id,
        secretAccessKey: pulumi.secret(awsUsers[i].accessKey.secret),
    };
    return acc;
}, {} as Record<string, object>);