import { ConversationHistoryService } from './services/conversation-history.service';

describe('ConversationHistoryService', () => {
  let service: ConversationHistoryService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      conversationMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new ConversationHistoryService(mockPrisma);
  });

  it('records user and assistant messages in memory and database', async () => {
    await service.recordMessage('cust-123', 'user', 'What is my balance?');
    await service.recordMessage('cust-123', 'assistant', 'Your balance is ₦50,000.');

    expect(mockPrisma.conversationMessage.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
      data: { customerId: 'cust-123', role: 'user', content: 'What is my balance?' },
    });
  });

  it('retrieves conversation history in chronological order', async () => {
    mockPrisma.conversationMessage.findMany.mockResolvedValue([
      { id: '2', role: 'assistant', content: 'Second message' },
      { id: '1', role: 'user', content: 'First message' },
    ]);

    const history = await service.getRecentHistory('cust-123', 5);

    expect(history).toHaveLength(2);
    // Chronological order: oldest first
    expect(history[0].content).toBe('First message');
    expect(history[1].content).toBe('Second message');
  });

  it('gracefully falls back to in-memory store when database throws', async () => {
    mockPrisma.conversationMessage.findMany.mockRejectedValue(new Error('DB offline'));
    mockPrisma.conversationMessage.create.mockRejectedValue(new Error('DB offline'));

    // Record in memory
    await service.recordMessage('cust-offline', 'user', 'Hello offline');
    await service.recordMessage('cust-offline', 'assistant', 'Hi offline');

    // Fetch from memory
    const history = await service.getRecentHistory('cust-offline');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hello offline');
    expect(history[1].content).toBe('Hi offline');
  });

  it('limits retrieved history to the requested count', async () => {
    for (let i = 1; i <= 15; i++) {
      await service.recordMessage('cust-limit', 'user', `Message ${i}`);
    }

    // Force memory-based retrieval
    mockPrisma.conversationMessage.findMany.mockRejectedValue(new Error('Use cache'));

    const history = await service.getRecentHistory('cust-limit', 5);
    expect(history).toHaveLength(5);
    expect(history[4].content).toBe('Message 15');
  });

  it('clears conversation history when requested', async () => {
    await service.recordMessage('cust-clear', 'user', 'Hello');
    await service.clearHistory('cust-clear');

    mockPrisma.conversationMessage.findMany.mockRejectedValue(new Error('Use cache'));
    const history = await service.getRecentHistory('cust-clear');
    expect(history).toHaveLength(0);
  });
});
