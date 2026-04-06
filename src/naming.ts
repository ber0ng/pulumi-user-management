import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack(); // "dev" || "prod"
const project = pulumi.getProject();

/** Consistent resource naming: {project}-{stack}-{name} */
export function resourceName(...parts: string[]): string {
    return [project, stack, ...parts].join("-").toLowerCase();
}

/** Tag map applied to all AWS resources */
export function baseTags(extra: Record<string, string> = {}): Record<string, string> {
    return {
        ManagedBy: "pulumi",
        Project: project,
        Environment: stack,
        ...extra,
    };
}