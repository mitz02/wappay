/**
 * Fix all tests broken by the new "PIN via secure WhatsApp Flow input" requirement.
 */

const fs = require('fs');
const path = require('path');

function patch(file, transforms) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [from, to] of transforms) {
    if (!src.includes(from)) {
      console.error(`NOT FOUND in ${path.basename(file)}:\n  ${JSON.stringify(from.slice(0, 80))}...`);
      process.exit(1);
    }
    src = src.replace(from, to);
  }
  fs.writeFileSync(file, src, 'utf8');
  console.log(`\u2714 ${path.basename(file)}`);
}

// ─── Line endings helper: normalise CRLF to LF for detection
function normCRLF(s) { return s.replace(/\r\n/g, '\n'); }

// Determine actual line ending in file
function lineEnding(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

// ─── 1. ai-assistant.service.spec.ts ─────────────────────────────────────────
const unitSpec = path.join(__dirname, '..', 'src', 'modules', 'artificial-intelligence', 'ai-assistant.service.spec.ts');
const uLE = lineEnding(unitSpec);
const u = (s) => s.replace(/\n/g, uLE); // apply line ending

patch(unitSpec, [
  // Fix: preview now shows "Enter Transaction PIN" not "Reply *YES* to confirm"
  [
    u("    expect(reply).toContain('Reply *YES* to confirm');\n  });\n\n  it('asks clarifying question when transfer recipient or amount is missing'"),
    u("    expect(reply).toContain('Enter Transaction PIN'); // Enter PIN button shown immediately\n  });\n\n  it('asks clarifying question when transfer recipient or amount is missing'"),
  ],

  // Fix: 4-step test -> 3-step, use submitTransferPin
  [
    u("  it('streamlines transfer flow in <= 4 steps from intent to PIN to success', async () => {\n    // Step 1: User expresses intent to send money to someone (details missing)\n    const reply1 = await service.processCustomerMessage('2348012345678', 'I want to send money to someone');\n    expect(reply1).toContain('Missing Transfer Details');\n    expect(reply1).toContain('Please specify both');\n\n    // Step 2: User provides recipient and amount -> Confirms details of user\n    const reply2 = await service.processCustomerMessage('2348012345678', '5000 to Mum');\n    expect(mockFinancialService.createTransferPreview).toHaveBeenCalledWith('cust-123', 'Mum', 500_000n);\n    expect(reply2).toContain('Simulated Transfer Confirmation');\n    expect(reply2).toContain('Jane Adeleke');\n    expect(reply2).toContain('\u20a65,000.00');\n\n    // Step 3: User confirms -> Prompt to enter transaction PIN\n    const reply3 = await service.processCustomerMessage('2348012345678', 'YES');\n    expect(reply3).toContain('Enter Transaction PIN');\n    expect(reply3).toContain('Please enter your 4-digit transaction PIN');\n\n    // Step 4: User inputs transaction PIN -> Success response!\n    const reply4 = await service.processCustomerMessage('2348012345678', '1234');\n    expect(mockFinancialService.confirmTransfer).toHaveBeenCalledWith('cust-123', '1234');\n    expect(reply4).toContain('Simulated Transfer Successful!');\n    expect(reply4).toContain('\u20a6244,990.00');\n  });"),
    u("  it('streamlines transfer flow in <= 3 steps: missing details \u2192 preview+PIN button \u2192 success', async () => {\n    // Step 1: User expresses intent with missing details\n    const reply1 = await service.processCustomerMessage('2348012345678', 'I want to send money to someone');\n    expect(reply1).toContain('Missing Transfer Details');\n    expect(reply1).toContain('Please specify both');\n\n    // Step 2: User provides details -> Bot shows preview with Enter PIN button (no YES needed)\n    const reply2 = await service.processCustomerMessage('2348012345678', '5000 to Mum');\n    expect(mockFinancialService.createTransferPreview).toHaveBeenCalledWith('cust-123', 'Mum', 500_000n);\n    expect(reply2).toContain('Simulated Transfer Confirmation');\n    expect(reply2).toContain('Jane Adeleke');\n    expect(reply2).toContain('\u20a65,000.00');\n    expect(reply2).toContain('Enter Transaction PIN');\n\n    // Step 3: User submits PIN via secure WhatsApp Flow input -> Success\n    const reply3 = await service.submitTransferPin('2348012345678', '1234');\n    expect(mockFinancialService.confirmTransfer).toHaveBeenCalledWith('cust-123', '1234');\n    expect(reply3).toContain('Simulated Transfer Successful!');\n    expect(reply3).toContain('\u20a6244,990.00');\n  });"),
  ],

  // Fix: 3-step -> 2-step test
  [
    u("  it('streamlines transfer in 3 steps when details are given initially', async () => {\n    // Step 1: User says \"Send 5000 naira to Mum\" -> Confirms details\n    const reply1 = await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n    expect(reply1).toContain('Simulated Transfer Confirmation');\n    expect(reply1).toContain('Jane Adeleke');\n\n    // Step 2: User confirms -> Prompts for PIN\n    const reply2 = await service.processCustomerMessage('2348012345678', 'YES');\n    expect(reply2).toContain('Enter Transaction PIN');\n\n    // Step 3: User inputs PIN -> Success response\n    const reply3 = await service.processCustomerMessage('2348012345678', '1234');\n    expect(reply3).toContain('Simulated Transfer Successful!');\n  });"),
    u("  it('streamlines transfer in 2 steps when details are given initially', async () => {\n    // Step 1: User says \"Send 5000 naira to Mum\" -> Bot shows preview with Enter PIN button\n    const reply1 = await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n    expect(reply1).toContain('Simulated Transfer Confirmation');\n    expect(reply1).toContain('Jane Adeleke');\n    expect(reply1).toContain('Enter Transaction PIN');\n\n    // Step 2: User submits PIN via secure WhatsApp Flow input -> Success\n    const reply2 = await service.submitTransferPin('2348012345678', '1234');\n    expect(reply2).toContain('Simulated Transfer Successful!');\n  });"),
  ],

  // Fix: invalid PIN format test
  [
    u("  it('returns failure response when invalid PIN format is provided', async () => {\n    await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n    await service.processCustomerMessage('2348012345678', 'YES');\n\n    // Invalid PIN format\n    const reply = await service.processCustomerMessage('2348012345678', '99');\n    expect(reply).toContain('Invalid PIN Format');\n  });"),
    u("  it('shows security warning when PIN typed in chat; submitTransferPin rejects bad format', async () => {\n    await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n\n    // Typing a 4-digit PIN in chat is rejected with a security warning\n    const chatReply = await service.processCustomerMessage('2348012345678', '9999');\n    expect(chatReply).toContain('Security Warning');\n\n    // Invalid PIN format via secure input (not 4 digits) returns error\n    const reply = await service.submitTransferPin('2348012345678', '99');\n    expect(reply).toContain('Invalid PIN Format');\n  });"),
  ],

  // Fix: transfer authorization fails test
  [
    u("  it('returns failure response when transfer authorization fails', async () => {\n    mockFinancialService.confirmTransfer.mockRejectedValueOnce(new Error('Insufficient balance to complete transfer.'));\n\n    await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n    await service.processCustomerMessage('2348012345678', 'YES');\n\n    const reply = await service.processCustomerMessage('2348012345678', '1234');\n    expect(reply).toContain('Transfer Failed');\n    expect(reply).toContain('Insufficient balance to complete transfer.');\n  });"),
    u("  it('returns failure response when transfer authorization fails via submitTransferPin', async () => {\n    mockFinancialService.confirmTransfer.mockRejectedValueOnce(new Error('Insufficient balance to complete transfer.'));\n\n    await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');\n\n    // PIN submitted via secure WhatsApp Flow input\n    const reply = await service.submitTransferPin('2348012345678', '1234');\n    expect(reply).toContain('Transfer Failed');\n    expect(reply).toContain('Insufficient balance to complete transfer.');\n  });"),
  ],
]);

// ─── 2. whatsapp-to-financial.integration.spec.ts ────────────────────────────
const intSpec = path.join(__dirname, '..', 'src', 'tests', 'integration', 'whatsapp-to-financial.integration.spec.ts');
const iLE = lineEnding(intSpec);
const i = (s) => s.replace(/\n/g, iLE);

patch(intSpec, [
  // Fix: preview test checks "Enter Transaction PIN" not "Reply *YES* to confirm"
  [
    i("    expect(reply).toContain('Simulated Transfer Confirmation');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    expect(reply).toContain('Reply *YES* to confirm');\r\n    expect(reply).toContain('0111222333'); // Mum's account number"),
    i("    expect(reply).toContain('Simulated Transfer Confirmation');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    expect(reply).toContain('Enter Transaction PIN'); // PIN button shown immediately\r\n    expect(reply).toContain('0111222333'); // Mum's account number"),
  ],

  // Fix: "executes the transfer" test -> use submitTransferPin
  [
    i("  it('executes the transfer and returns verified result after YES confirmation', async () => {\r\n    const { assistant } = buildServiceGraph();\r\n\r\n    // Phase 1: create preview\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n\r\n    // Phase 2: confirm \u2192 now prompts for PIN (new 4-step flow)\r\n    const pinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');\r\n    expect(pinPrompt).toContain('PIN');\r\n\r\n    // Phase 3: enter PIN \u2192 success\r\n    const reply = await assistant.processCustomerMessage('2348012345678', '1234');\r\n\r\n    expect(reply).toContain('Simulated Transfer Successful!');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    // New balance must be computed by the real MockFinancialService (not invented)\r\n    expect(reply).toMatch(/Available Balance.*\u20a6/);\r\n    // Must contain a real reference prefixed MOCK_TXN_\r\n    expect(reply).toMatch(/MOCK_TXN_/);\r\n  });"),
    i("  it('executes the transfer via secure PIN input after preview', async () => {\r\n    const { assistant } = buildServiceGraph();\r\n\r\n    // Phase 1: preview — bot shows transfer details with Enter PIN button\r\n    const preview = await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    expect(preview).toContain('Simulated Transfer Confirmation');\r\n    expect(preview).toContain('Enter Transaction PIN');\r\n\r\n    // Phase 2: user submits PIN via secure WhatsApp Flow input \u2192 success\r\n    const reply = await assistant.submitTransferPin('2348012345678', '1234');\r\n\r\n    expect(reply).toContain('Simulated Transfer Successful!');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    // New balance must be computed by the real MockFinancialService (not invented)\r\n    expect(reply).toMatch(/Available Balance.*\u20a6/);\r\n    // Must contain a real reference prefixed MOCK_TXN_\r\n    expect(reply).toMatch(/MOCK_TXN_/);\r\n  });"),
  ],

  // Fix: "reflects reduced balance" test -> use submitTransferPin
  [
    i("    // Phase 1 + Phase 2 + Phase 3 (PIN)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.processCustomerMessage('2348012345678', 'YES');   // returns PIN prompt\r\n    await assistant.processCustomerMessage('2348012345678', '1234');  // enter PIN \u2192 executes transfer"),
    i("    // Phase 1: preview; Phase 2: submit PIN via secure input\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.submitTransferPin('2348012345678', '1234'); // secure PIN \u2192 executes transfer"),
  ],

  // Fix: "remembers pending transfer" preview assertion
  [
    i("    expect(preview).toContain('Reply *YES* to confirm');"),
    i("    expect(preview).toContain('Enter Transaction PIN');"),
  ],

  // Fix: "remembers pending transfer" confirmation step -> use submitTransferPin
  [
    i("    // Turn 2: confirm \u2014 \"yes\" is in the confirmRegex \u2192 now returns PIN prompt\r\n    const pinPrompt2 = await assistant.processCustomerMessage('2348012345678', 'Yes');\r\n    expect(pinPrompt2).toContain('PIN');\r\n\r\n    // Turn 3: enter PIN \u2192 success\r\n    const confirmation = await assistant.processCustomerMessage('2348012345678', '1234');\r\n    expect(confirmation).toContain('Simulated Transfer Successful!');"),
    i("    // Turn 2: user submits PIN via secure WhatsApp Flow input \u2192 success\r\n    const confirmation = await assistant.submitTransferPin('2348012345678', '1234');\r\n    expect(confirmation).toContain('Simulated Transfer Successful!');"),
  ],

  // Fix: "queries new balance" test -> use submitTransferPin
  [
    i("    // Execute transfer (3-step: preview \u2192 YES \u2192 PIN)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.processCustomerMessage('2348012345678', 'YES');   // PIN prompt\r\n    await assistant.processCustomerMessage('2348012345678', '1234');  // executes transfer"),
    i("    // Execute transfer (2-step: preview \u2192 submitTransferPin via secure input)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.submitTransferPin('2348012345678', '1234'); // secure PIN \u2192 executes transfer"),
  ],

  // Fix: "preserves conversation isolation" -> use submitTransferPin for Adebayo
  [
    i("    // Adebayo confirms: must use HIS pending transfer (not Chioma's session)\r\n    // YES \u2192 PIN prompt, then PIN \u2192 success\r\n    const adebayoPinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');\r\n    expect(adebayoPinPrompt).toContain('PIN');\r\n    const adebayoConfirm = await assistant.processCustomerMessage('2348012345678', '1234');\r\n    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');\r\n    expect(adebayoConfirm).toContain('Jane Adeleke');"),
    i("    // Adebayo submits PIN via secure WhatsApp Flow input (uses HIS pending transfer)\r\n    const adebayoConfirm = await assistant.submitTransferPin('2348012345678', '1234');\r\n    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');\r\n    expect(adebayoConfirm).toContain('Jane Adeleke');"),
  ],
]);

console.log('\nAll patches applied \u2714');
