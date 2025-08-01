// modules/networking/index.ts
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { awsProvider } from "../../config/aws-config"
export interface NetworkingStackArgs {
    config: {
        cidrBlock: string;
        availabilityZones: string[];
    };
}

export class NetworkingStack extends pulumi.ComponentResource {
    public readonly vpc: aws.ec2.Vpc;
    public readonly publicSubnets: aws.ec2.Subnet[];
    public readonly privateSubnets: aws.ec2.Subnet[];
    public readonly internetGateway: aws.ec2.InternetGateway;
    public readonly natGateways: aws.ec2.NatGateway[];
    public readonly publicRouteTable: aws.ec2.RouteTable;
    public readonly privateRouteTables: aws.ec2.RouteTable[];

    constructor(name: string, args: NetworkingStackArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:networking:NetworkingStack", name, {}, opts);

        // Create VPC
        this.vpc = new aws.ec2.Vpc(`${name}-vpc`, {
            cidrBlock: args.config.cidrBlock,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: {
                Name: `${name}-vpc`,
                Type: "networking",
            },
        }, { parent: this, provider: awsProvider });

        // Create Internet Gateway
        this.internetGateway = new aws.ec2.InternetGateway(`${name}-igw`, {
            vpcId: this.vpc.id,
            tags: { Name: `${name}-igw` },
        }, { parent: this, provider: awsProvider });

        // Create subnets
        this.publicSubnets = this.createPublicSubnets(name, args.config.availabilityZones);
        this.privateSubnets = this.createPrivateSubnets(name, args.config.availabilityZones);
        this.natGateways = this.createNatGateways(name);
        
        // Create route tables and routes
        this.publicRouteTable = this.createPublicRouteTable(name);
        this.privateRouteTables = this.createPrivateRouteTables(name);

        this.registerOutputs({
            vpcId: this.vpc.id,
            publicSubnetIds: this.publicSubnets.map(s => s.id),
            privateSubnetIds: this.privateSubnets.map(s => s.id),
        });
    }

    private createPublicSubnets(name: string, azs: string[]): aws.ec2.Subnet[] {
        return azs.map((az, index) => {
            return new aws.ec2.Subnet(`${name}-public-${index}`, {
                vpcId: this.vpc.id,
                cidrBlock: `10.0.${index * 2}.0/24`,
                availabilityZone: az,
                mapPublicIpOnLaunch: true,
                tags: {
                    Name: `${name}-public-${index}`,
                    Type: "public",
                },
            }, { parent: this, provider: awsProvider });
        });
    }

    private createPrivateSubnets(name: string, azs: string[]): aws.ec2.Subnet[] {
        return azs.map((az, index) => {
            return new aws.ec2.Subnet(`${name}-private-${index}`, {
                vpcId: this.vpc.id,
                cidrBlock: `10.0.${(index * 2) + 1}.0/24`,
                availabilityZone: az,
                tags: {
                    Name: `${name}-private-${index}`,
                    Type: "private",
                },
            }, { parent: this, provider: awsProvider });
        });
    }

    private createNatGateways(name: string): aws.ec2.NatGateway[] {
        return this.publicSubnets.map((subnet, index) => {
            const eip = new aws.ec2.Eip(`${name}-nat-eip-${index}`, {
                domain: "vpc",
                tags: { Name: `${name}-nat-eip-${index}` },
            }, { parent: this, provider: awsProvider });

            return new aws.ec2.NatGateway(`${name}-nat-${index}`, {
                allocationId: eip.id,
                subnetId: subnet.id,
                tags: { Name: `${name}-nat-${index}` },
            }, { parent: this, provider: awsProvider });
        });
    }

    private createPublicRouteTable(name: string): aws.ec2.RouteTable {
        // Create public route table
        const publicRouteTable = new aws.ec2.RouteTable(`${name}-public-rt`, {
            vpcId: this.vpc.id,
            tags: {
                Name: `${name}-public-rt`,
                Type: "public",
            },
        }, { parent: this, provider: awsProvider });

        // Create route to Internet Gateway
        new aws.ec2.Route(`${name}-public-route`, {
            routeTableId: publicRouteTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: this.internetGateway.id,
        }, { parent: this, provider: awsProvider });

        // Associate public subnets with public route table
        this.publicSubnets.forEach((subnet, index) => {
            new aws.ec2.RouteTableAssociation(`${name}-public-rta-${index}`, {
                subnetId: subnet.id,
                routeTableId: publicRouteTable.id,
            }, { parent: this, provider: awsProvider });
        });

        return publicRouteTable;
    }

    private createPrivateRouteTables(name: string): aws.ec2.RouteTable[] {
        return this.privateSubnets.map((subnet, index) => {
            // Create private route table for each AZ
            const privateRouteTable = new aws.ec2.RouteTable(`${name}-private-rt-${index}`, {
                vpcId: this.vpc.id,
                tags: {
                    Name: `${name}-private-rt-${index}`,
                    Type: "private",
                },
            }, { parent: this, provider: awsProvider });

            // Create route to NAT Gateway
            new aws.ec2.Route(`${name}-private-route-${index}`, {
                routeTableId: privateRouteTable.id,
                destinationCidrBlock: "0.0.0.0/0",
                natGatewayId: this.natGateways[index].id,
            }, { parent: this, provider: awsProvider });

            // Associate private subnet with its route table
            new aws.ec2.RouteTableAssociation(`${name}-private-rta-${index}`, {
                subnetId: subnet.id,
                routeTableId: privateRouteTable.id,
            }, { parent: this, provider: awsProvider });

            return privateRouteTable;
        });
    }
}