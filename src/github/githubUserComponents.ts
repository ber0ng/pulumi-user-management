import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import { UserConfig } from "../types";
import { resourceName } from "../naming";

interface GitHubTeams {
    backend: github.Team;
    frontend: github.Team;
}

export class GitHubUserComponent extends pulumi.ComponentResource {
    public readonly membership: github.Membership;
    public readonly teamMembership: github.TeamMembership;

    constructor(user: UserConfig, teams: GitHubTeams, opts?: pulumi.ComponentResourceOptions) {
        super("user-mgmt:github:User", resourceName("gh", user.name), {}, opts);

        const childOpts = { parent: this, provider: opts?.provider as github.Provider | undefined };

        // Invite user to the GitHub org
        this.membership = new github.Membership(
            resourceName("gh-member", user.name),
            {
                username: user.name,
                role: user.role === "lead" ? "member" : "member", // org admin would be "admin"
            },
            childOpts
        );

        // Add user to their team
        const team = teams[user.github_team];
        this.teamMembership = new github.TeamMembership(
            resourceName("gh-team-member", user.name),
            {
                teamId: team.id,
                username: user.name,
                role: user.role === "lead" ? "maintainer" : "member",
            },
            childOpts
        );

        this.registerOutputs({
            membership: this.membership.id,
            teamMembership: this.teamMembership.id,
        });
    }
}

export function createGitHubTeams(org: string, provider: github.Provider): GitHubTeams {
    const makeTeam = (slug: string, description: string) =>
        new github.Team(resourceName("team", slug), {
            name: slug,
            description,
            privacy: "closed",
        }, { provider });

    return {
        backend: makeTeam("backend", "Backend engineers"),
        frontend: makeTeam("frontend", "Frontend engineers"),
    };
}