import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { UserConfig } from "../types";
import { resourceName, baseTags } from "../naming";

export interface SsoConfig {
    instanceArn: string;
    identityStoreId: string;
    awsAccountId: string;
}

export interface AwsGroups {
    developers: {
        group: aws.identitystore.Group;
        permissionSet: aws.ssoadmin.PermissionSet;
    };
    admins: {
        group: aws.identitystore.Group;
        permissionSet: aws.ssoadmin.PermissionSet;
    };
}

export class AwsUserComponent extends pulumi.ComponentResource {
    public readonly user?: aws.identitystore.User;

    constructor(user: UserConfig, groups: AwsGroups, ssoConfig: SsoConfig, opts?: pulumi.ComponentResourceOptions) {
        super("user-mgmt:aws:User", resourceName("sso", user.name), {}, opts);

        const stack = pulumi.getStack();
        const childOpts = { parent: this };

        // SSO users are global per AWS account — only create in dev stack
        if (stack === "dev") {
            this.user = new aws.identitystore.User(
                resourceName("sso-user", user.name),
                {
                    identityStoreId: ssoConfig.identityStoreId,
                    userName: user.name,
                    displayName: user.name,
                    name: {
                        givenName: user.name,
                        familyName: user.name,
                    },
                    emails: {
                        value: user.email,
                        primary: true,
                        type: "work",
                    },
                },
                childOpts
            );

            for (const grp of user.aws_groups ?? []) {
                const groupData = groups[grp as keyof AwsGroups];
                if (!groupData) continue;
                new aws.identitystore.GroupMembership(
                    resourceName("sso-member", user.name, grp),
                    {
                        identityStoreId: ssoConfig.identityStoreId,
                        groupId: groupData.group.groupId,
                        memberId: this.user.userId,
                    },
                    childOpts
                );
            }
        }

        this.registerOutputs({
            userId: this.user?.userId,
            userName: this.user?.userName,
        });
    }
}

export function createAwsGroups(ssoConfig: SsoConfig): AwsGroups {
    const accountId = ssoConfig.awsAccountId;

    const makeGroup = (
        slug: string,
        description: string,
        managedPolicyArn: string,
    ) => {
        const group = new aws.identitystore.Group(resourceName("sso-group", slug), {
            identityStoreId: ssoConfig.identityStoreId,
            displayName: resourceName(slug),
            description,
        });

        const permissionSet = new aws.ssoadmin.PermissionSet(resourceName("ps", slug), {
            instanceArn: ssoConfig.instanceArn,
            name: resourceName(slug),
            description,
            sessionDuration: "PT8H",
            tags: baseTags(),
        });

        new aws.ssoadmin.ManagedPolicyAttachment(resourceName("ps-policy", slug), {
            instanceArn: ssoConfig.instanceArn,
            permissionSetArn: permissionSet.arn,
            managedPolicyArn,
        });

        new aws.ssoadmin.AccountAssignment(resourceName("ps-assign", slug), {
            instanceArn: ssoConfig.instanceArn,
            permissionSetArn: permissionSet.arn,
            principalId: group.groupId,
            principalType: "GROUP",
            targetId: accountId,
            targetType: "AWS_ACCOUNT",
        });

        return { group, permissionSet };
    };

    return {
        developers: makeGroup(
            "developers",
            "Read-only access for developers",
            "arn:aws:iam::aws:policy/ReadOnlyAccess",
        ),
        admins: makeGroup(
            "admins",
            "Power user access for admins",
            "arn:aws:iam::aws:policy/PowerUserAccess",
        ),
    };
}
