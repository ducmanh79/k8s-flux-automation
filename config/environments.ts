// config/environments.ts
import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack();

const configs = {
    dev: {
        // EKS Configuration
        eks: {
            version: "1.33",
            nodeGroups: {
                workers: {
                    instanceTypes: ["t2.medium"],
                    minSize: 1,
                    maxSize: 3,
                    desiredSize: 2,
                }
            }
        },
        // RDS Configuration
        rds: {
            instanceClass: "db.t3.micro",
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
        },
        // VPC Configuration
        vpc: {
            cidrBlock: "10.0.0.0/16",
            availabilityZones: ["ap-southeast-1a", "ap-southeast-1b"],
        }
    },
    staging: {
        eks: {
            version: "1.28",
            nodeGroups: {
                workers: {
                    instanceTypes: ["t3.large"],
                    minSize: 2,
                    maxSize: 5,
                    desiredSize: 3,
                }
            }
        },
        rds: {
            instanceClass: "db.t3.small",
            allocatedStorage: 100,
            maxAllocatedStorage: 500,
        },
        vpc: {
            cidrBlock: "10.1.0.0/16",
            availabilityZones: ["us-west-2a", "us-west-2b", "us-west-2c"],
        }
    },
    prod: {
        eks: {
            version: "1.28",
            nodeGroups: {
                workers: {
                    instanceTypes: ["m5.large"],
                    minSize: 3,
                    maxSize: 10,
                    desiredSize: 5,
                }
            }
        },
        rds: {
            instanceClass: "db.r5.large",
            allocatedStorage: 500,
            maxAllocatedStorage: 2000,
        },
        vpc: {
            cidrBlock: "10.2.0.0/16",
            availabilityZones: ["us-east-1a", "us-east-1b", "us-east-1c"],
        }
    }
};

export const environmentConfig = configs[stack as keyof typeof configs] || configs.dev;