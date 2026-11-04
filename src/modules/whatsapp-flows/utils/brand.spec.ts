import { withBrand, formatNaira, formatBalance } from './brand';

describe('brand utilities', () => {
  describe('withBrand', () => {
    it('should append brand sign-off to message', () => {
      const result = withBrand('Hello world');
      expect(result).toBe('Hello world\n\nfrom WappPay');
    });

    it('should not duplicate brand if already present', () => {
      const result = withBrand('Hello\n\nfrom WappPay');
      expect(result).toBe('Hello\n\nfrom WappPay');
    });

    it('should handle empty message', () => {
      const result = withBrand('');
      expect(result).toBe('\n\nfrom WappPay');
    });

    it('should handle message with trailing whitespace', () => {
      const result = withBrand('Hello  ');
      expect(result).toBe('Hello\n\nfrom WappPay');
    });
  });

  describe('formatNaira', () => {
    it('should format kobo as Naira string', () => {
      expect(formatNaira(BigInt(500000))).toBe('₦5,000.00');
      expect(formatNaira(BigInt(0))).toBe('₦0.00');
      expect(formatNaira(BigInt(100))).toBe('₦1.00');
      expect(formatNaira(BigInt(12345678))).toBe('₦123,456.78');
    });

    it('should accept number input', () => {
      expect(formatNaira(500000)).toBe('₦5,000.00');
    });
  });

  describe('formatBalance', () => {
    it('should format balance same as formatNaira', () => {
      expect(formatBalance(BigInt(25000000))).toBe('₦250,000.00');
    });
  });
});
