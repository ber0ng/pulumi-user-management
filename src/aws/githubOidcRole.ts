import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { resourceName, baseTags } from "../naming";

interface GitHubOidcRoleArgs {
    /** Full repo path that runs the workflow, e.g. "ber0ng/pulumi-user-management" */
    repoPath: string;

    /** IAM policy statements to attach to the role */
    policyStatements: object[];
}

export interface GitHubOidcRoleOutputs {
    roleArn: pulumi.Output<string>;
    roleName: pulumi.Output<string>;
}

const GITHUB_OIDC_URL = "https://token.actions.githubusercontent.com";

export function createGitHubOidcRole(args: GitHubOidcRoleArgs): GitHubOidcRoleOutputs {
    // Look up existing OIDC provider — only one allowed per AWS account per URL
    const oidcProvider = aws.iam.getOpenIdConnectProviderOutput({
        url: GITHUB_OIDC_URL,
    });

    // Trust policy: only allow the specified org/repo to assume this role
    const trustPolicy = oidcProvider.arn.apply(providerArn =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: { Federated: providerArn },
                    Action: "sts:AssumeRoleWithWebIdentity",
                    Condition: {
                        StringLike: {
                            "token.actions.githubusercontent.com:sub":
                                `repo:${args.repoPath}:*`,
                        },
                        StringEquals: {
                            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                        },
                    },
                },
            ],
        })
    );

    const role = new aws.iam.Role(
        resourceName("role-github-actions"),
        {
            name: resourceName("github-actions"),
            assumeRolePolicy: trustPolicy,
            tags: baseTags(),
        }
    );

    new aws.iam.RolePolicy(
        resourceName("role-policy-github-actions"),
        {
            role: role.name,
            policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: args.policyStatements,
            }),
        }
    );

    return {
        roleArn: role.arn,
        roleName: role.name,
    };
}