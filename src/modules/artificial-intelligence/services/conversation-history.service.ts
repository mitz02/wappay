import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChatMessage } from '../../../contracts/ai/ai-provider.contract';
import { AI_CONSTANTS } from '../ai.constants';

@Injectable()
export class ConversationHistoryService {
  private readonly logger = new Logger(ConversationHistoryService.name);
  // Resilient memory cache used if database is offline or in mock unit tests
  private readonly memoryFallback = new Map<string, ChatMessage[]>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the most recent conversational turns for a customer.
   *
   * @param customerId - The unique ID of the customer profile.
   * @param limit - Maximum number of messages to retrieve (default: AI_CONSTANTS.MAX_HISTORY_MESSAGES).
   * @returns Chronologically ordered array of ChatMessage objects (oldest to newest).
   */
  async getRecentHistory(
    customerId: string,
    limit: number = AI_CONSTANTS.MAX_HISTORY_MESSAGES,
  ): Promise<ChatMessage[]> {
    try {
      if (this.prisma && this.prisma.conversationMessage) {
        const records = await this.prisma.conversationMessage.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        if (records && records.length > 0) {
          // Reverse back to chronological order (oldest -> newest) for model context
          return records.reverse().map((r) => ({
            role: r.role as 'system' | 'user' | 'assistant',
            content: r.content,
          }));
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.debug(
        `Database conversation query fallback for customer ${customerId}: ${error.message}`,
      );
    }

    // Fallback to in-memory store
    const cached = this.memoryFallback.get(customerId) || [];
    return cached.slice(-limit);
  }

  /**
   * Appends a message to the customer's conversational history.
   *
   * @param customerId - The unique ID of the customer profile.
   * @param role - Role of the author ('user' | 'assistant' | 'system').
   * @param content - Text content of the message.
   */
  async recordMessage(
    customerId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Always update in-memory cache for immediate consistency
    const cached = this.memoryFallback.get(customerId) || [];
    cached.push({ role, content: trimmed });
    if (cached.length > AI_CONSTANTS.MAX_HISTORY_MESSAGES * 2) {
      cached.shift();
    }
    this.memoryFallback.set(customerId, cached);

    // Persist to database if available
    try {
      if (this.prisma && this.prisma.conversationMessage) {
        await this.prisma.conversationMessage.create({
          data: {
            customerId,
            role,
            content: trimmed,
          },
        });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.debug(
        `Database message persistence skipped/failed for customer ${customerId}: ${error.message}`,
      );
    }
  }

  /**
   * Clears conversational history for testing or session reset.
   */
  async clearHistory(customerId: string): Promise<void> {
    this.memoryFallback.delete(customerId);
    try {
      if (this.prisma && this.prisma.conversationMessage) {
        await this.prisma.conversationMessage.deleteMany({
          where: { customerId },
        });
      }
    } catch {
      // Ignored in test/offline environments
    }
  }
}
