import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // List proposals with optional status filter
  // ---------------------------------------------------------------------------

  async getProposals(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const proposals = await this.prisma.governanceProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        proposer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, title: true },
        },
      },
    });

    return proposals;
  }

  // ---------------------------------------------------------------------------
  // Get a single proposal by ID (includes voter's own vote if userId provided)
  // ---------------------------------------------------------------------------

  async getProposal(id: number, userId?: number) {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id },
      include: {
        proposer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, title: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${id} not found`);
    }

    // Check if current user has voted
    let hasVoted = false;
    let userVote: string | undefined;
    let userVoteWeight: number | undefined;

    if (userId) {
      const vote = await this.prisma.governanceVote.findUnique({
        where: {
          proposalId_voterId: { proposalId: id, voterId: userId },
        },
      });
      if (vote) {
        hasVoted = true;
        userVote = vote.vote;
        userVoteWeight = vote.weight;
      }
    }

    return { ...proposal, hasVoted, userVote, userVoteWeight };
  }

  // ---------------------------------------------------------------------------
  // Create a new proposal (must be an investor in the property)
  // ---------------------------------------------------------------------------

  async createProposal(
    userId: number,
    data: { propertyId: number; title: string; description: string },
  ) {
    // Verify the user has an investment in this property
    const investment = await this.prisma.investment.findFirst({
      where: { investorId: userId, propertyId: data.propertyId },
    });

    if (!investment) {
      throw new ForbiddenException(
        'You must be an investor in this property to create a proposal',
      );
    }

    // Verify property exists
    const property = await this.prisma.property.findUnique({
      where: { id: data.propertyId },
    });
    if (!property) {
      throw new NotFoundException(`Property #${data.propertyId} not found`);
    }

    // Count total investors in this property to set quorum (majority of investors)
    const investorCount = await this.prisma.investment.count({
      where: { propertyId: data.propertyId },
    });

    const quorum = Math.max(Math.ceil(investorCount * 0.5), 1); // 50% quorum

    // Voting period: 7 days from now
    const votingEndsAt = new Date();
    votingEndsAt.setDate(votingEndsAt.getDate() + 7);

    const proposal = await this.prisma.governanceProposal.create({
      data: {
        propertyId: data.propertyId,
        proposerId: userId,
        title: data.title,
        description: data.description,
        quorum,
        votingEndsAt,
      },
      include: {
        proposer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: {
          select: { id: true, title: true },
        },
      },
    });

    return proposal;
  }

  // ---------------------------------------------------------------------------
  // Cast a vote on a proposal
  // ---------------------------------------------------------------------------

  async castVote(
    proposalId: number,
    userId: number,
    voteDirection: string,
  ) {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    if (proposal.status !== 'active') {
      throw new BadRequestException('This proposal is no longer active');
    }

    if (new Date() > proposal.votingEndsAt) {
      throw new BadRequestException('Voting period has ended');
    }

    // Must be an investor in the property
    const investment = await this.prisma.investment.findFirst({
      where: { investorId: userId, propertyId: proposal.propertyId },
    });

    if (!investment) {
      throw new ForbiddenException(
        'You must be an investor in this property to vote',
      );
    }

    // Check if already voted
    const existingVote = await this.prisma.governanceVote.findUnique({
      where: {
        proposalId_voterId: { proposalId, voterId: userId },
      },
    });

    if (existingVote) {
      throw new BadRequestException('You have already voted on this proposal');
    }

    // Weight based on investment amount (1 vote per 1000 invested, minimum 1)
    const weight = Math.max(
      Math.floor(Number(investment.amountInvested) / 1000),
      1,
    );

    // Create vote and update proposal counts in a transaction
    const [_vote] = await this.prisma.$transaction([
      this.prisma.governanceVote.create({
        data: {
          proposalId,
          voterId: userId,
          vote: voteDirection,
          weight,
        },
      }),
      this.prisma.governanceProposal.update({
        where: { id: proposalId },
        data:
          voteDirection === 'for'
            ? { forVotes: { increment: weight } }
            : { againstVotes: { increment: weight } },
      }),
    ]);

    // Check if quorum is met and auto-resolve
    const updated = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
    });
    if (updated) {
      const totalVotes = updated.forVotes + updated.againstVotes;
      if (totalVotes >= updated.quorum) {
        const newStatus = updated.forVotes > updated.againstVotes ? 'passed' : 'failed';
        await this.prisma.governanceProposal.update({
          where: { id: proposalId },
          data: { status: newStatus },
        });
      }
    }

    return { proposalId, vote: voteDirection, weight };
  }

  // ---------------------------------------------------------------------------
  // Get current user's votes across all proposals
  // ---------------------------------------------------------------------------

  async getMyVotes(userId: number) {
    const votes = await this.prisma.governanceVote.findMany({
      where: { voterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        proposal: {
          include: {
            proposer: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            property: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    return votes.map((v) => ({
      proposalId: v.proposalId,
      proposal: v.proposal,
      vote: v.vote,
      weight: v.weight,
      votedAt: v.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Execute a passed proposal (proposer or admin only)
  // ---------------------------------------------------------------------------

  async executeProposal(proposalId: number, userId: number) {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    if (proposal.status !== 'passed') {
      throw new BadRequestException('Only passed proposals can be executed');
    }

    if (proposal.proposerId !== userId) {
      // Check if admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });
      if (user?.roleId !== 'admin') {
        throw new ForbiddenException(
          'Only the proposer or an admin can execute this proposal',
        );
      }
    }

    const updated = await this.prisma.governanceProposal.update({
      where: { id: proposalId },
      data: { status: 'executed', executedAt: new Date() },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cancel a proposal (proposer or admin only, only if still active)
  // ---------------------------------------------------------------------------

  async cancelProposal(proposalId: number, userId: number) {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal #${proposalId} not found`);
    }

    if (proposal.status !== 'active') {
      throw new BadRequestException('Only active proposals can be cancelled');
    }

    if (proposal.proposerId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { roleId: true },
      });
      if (user?.roleId !== 'admin') {
        throw new ForbiddenException(
          'Only the proposer or an admin can cancel this proposal',
        );
      }
    }

    const updated = await this.prisma.governanceProposal.update({
      where: { id: proposalId },
      data: { status: 'cancelled' },
    });

    return updated;
  }
}
