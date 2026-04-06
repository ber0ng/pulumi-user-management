import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { UserConfig } from "../types";
import { resourceName, baseTags } from "../naming";

export interface AwsGroups {
    developers: aws.iam.Group;
    admins: aws.iam.Group;
}

export class AwsUserComponent extends pulumi.ComponentResource {
    public readonly user: aws.iam.User;
    public readonly accessKey: aws.iam.AccessKey;

    constructor(user: UserConfig, groups: AwsGroups, opts?: pulumi.ComponentResourceOptions) {
        super("user-mgmt:aws:User", resourceName("iam", user.name), {}, opts);

        const childOpts = { parent: this };
        const tags = baseTags({ User: user.name, Account: user.aws_account });

        // IAM user
        this.user = new aws.iam.User(
            resourceName("iam-user", user.name),
            {
                name: resourceName(user.aws_account, user.name),
                path: `/${user.aws_account}/`,
                tags,
            },
            childOpts
        );

        // Programmatic access key (stored in Pulumi state, exported as secret)
        this.accessKey = new aws.iam.AccessKey(
            resourceName("iam-key", user.name),
            { user: this.user.name },
            childOpts
        );

        // Assign to each group
        for (const grp of user.aws_groups ?? []) {
            const group = groups[grp as keyof AwsGroups];
            if (!group) continue;
            new aws.iam.UserGroupMembership(
                resourceName("iam-grp-member", user.name, grp),
                {
                    user: this.user.name,
                    groups: [group.name],
                },
                childOpts
            );
        }

        this.registerOutputs({
            userName: this.user.name,
            userArn: this.user.arn,
        });
    }
}

/** Creates IAM groups with least-privilege policies **/
export function createAwsGroups(): AwsGroups {
    const devPolicy = new aws.iam.Policy(resourceName("policy", "dev-readonly"), {
        description: "Read-only access for dev account users",
        policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "s3:GetObject", "s3:ListBucket",
                        "ec2:Describe*",
                        "logs:GetLogEvents", "logs:FilterLogEvents", "logs:DescribeLogGroups",
                        "cloudwatch:GetMetricData", "cloudwatch:ListMetrics",
                    ],
                    Resource: "*",
                },
            ],
        }),
        tags: baseTags(),
    });

    const adminPolicy = new aws.iam.Policy(resourceName("policy", "admin-limited"), {
        description: "Scoped admin access — no IAM write, no billing",
        policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: ["ec2:*", "s3:*", "rds:*", "cloudwatch:*", "logs:*"],
                    Resource: "*",
                },
                {
                    Effect: "Deny",
                    Action: ["iam:*", "organizations:*", "aws-portal:*"],
                    Resource: "*",
                },
            ],
        }),
        tags: baseTags(),
    });

    const developers = new aws.iam.Group(resourceName("group", "developers"), {
        name: resourceName("developers"),
        path: "/groups/",
    });

    new aws.iam.GroupPolicyAttachment(resourceName("gpa", "dev-policy"), {
        group: developers.name,
        policyArn: devPolicy.arn,
    });

    const admins = new aws.iam.Group(resourceName("group", "admins"), {
        name: resourceName("admins"),
        path: "/groups/",
    });

    new aws.iam.GroupPolicyAttachment(resourceName("gpa", "admin-policy"), {
        group: admins.name,
        policyArn: adminPolicy.arn,
    });

    return { developers, admins };
}