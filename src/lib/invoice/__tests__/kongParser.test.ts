/**
 * Unit tests for Kong invoice parser.
 * Run with: npx vitest run src/lib/invoice/__tests__/kongParser.test.ts
 */

import { describe, it, expect } from 'vitest';
import { kongParser } from '../kongParser';

const KONG_SAMPLE = `
Kong's (Aust.) Pty. Limited
Tax Invoice 918685
A.B.N.  68 050 291 766
97 Williamson Road
INGLEBURN NSW 2565
Date
1/10/2025
Account
CHIPET CHINCHILLA2
Order No.
WEB/30-9-2025
Contact
JAMES STRAIN
Sales Rep
JASON BOORMAN
Con Note #
P003548091
Page
1/3
ItemDescriptionItem Barcode
Qty
Ord
Qty
Del
Qty
BO
Unit PriceDisc.
10321Scraper 4 In 1 24in  60cm9325136000511101002.860
ZP251
3
2.86Each2.861031.46
11754Vege Wafer Food 1kg932513617110566010.450
ZP251
3
10.45Each10.451068.97
20136Vac A Tank Gravel Cleaner 12.5cm 5in93251360432426606.3025DM254.73Each4.731031.22
23210Multi Purpose Tongs Curved 30cm Stainless Steel93251361773812209.320
ZP251
3
9.32Each9.321020.50
46619Thermostat EziStat Single Socket 400w Capacity932513613660933038.670
ZP251
3
38.67Each38.6710127.61
56170
Horizon 130 Glass Starter Kit W Stand 130L 92 W X 36
D X 42+72cm H
9325136082425220273.900
ZP251
3
273.90Each273.9010602.58
59154
Reflector Mini Touch LED 8W Suit 25 To 45cm
Aquarium
932513613258855019.770
ZP251
3
19.77Each19.7710108.74
DC24Cage Cover Suits D24 Cages932513619144811014.350
ZP251
3
14.35Each14.351015.79
DC36Cage Cover Suits D36 Cages932513619146211021.820
ZP251
3
21.82Each21.821024.00
DC48Cage Cover Suits D48 Cages932513619148611036.200
ZP251
3
36.20Each36.201039.82
KIT2516Assorted Dog Toys with Bonus Display Bin110295.000
ZP251
3
295.00Set295.0010324.50
KIT2519Assorted Dog Toys with Bonus Display Bin110380.000
ZP251
3
380.00Set380.0010418.00
11577Cichlid Pellet Food Sinking 1kg932513615714744015.960
ZP251
3
15.96Each15.961070.22
ALL GOODS SHOULD BE CHECKED UPON ARRIVAL.
Price (ex GST)
$1,744.59
TOTAL
$2,100.50
`;

function hasItemWithName(items: { name: string }[], name: string): boolean {
  return items.some((i) => i.name.includes(name) || name.includes(i.name));
}

function getItemByName(items: { name: string; price: number; quantity: number }[], name: string) {
  return items.find((i) => i.name.includes(name) || name.includes(i.name));
}

describe('kongParser', () => {
  it('extracts many more than 7 items', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(items.length).toBeGreaterThanOrEqual(12);
  });

  it('extracts Scraper 4 In 1 24in 60cm', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(hasItemWithName(items, 'Scraper 4 In 1 24in')).toBe(true);
    const item = getItemByName(items, 'Scraper');
    expect(item?.price).toBe(2.86);
  });

  it('extracts Cichlid Pellet Food Sinking 1kg with correct price', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(hasItemWithName(items, 'Cichlid Pellet')).toBe(true);
    const item = getItemByName(items, 'Cichlid');
    expect(item?.price).toBe(15.96);
  });

  it('extracts Vege Wafer Food 1kg with correct price 10.45', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const item = getItemByName(items, 'Vege Wafer');
    expect(item).toBeDefined();
    expect(item?.price).toBe(10.45);
  });

  it('extracts Multi Purpose Tongs with correct price 9.32', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const item = getItemByName(items, 'Multi Purpose Tongs');
    expect(item).toBeDefined();
    expect(item?.price).toBe(9.32);
  });

  it('extracts Thermostat EziStat with correct price 38.67', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const item = getItemByName(items, 'Thermostat EziStat');
    expect(item).toBeDefined();
    expect(item?.price).toBe(38.67);
  });

  it('preserves multiline name: Horizon 130 Glass Starter Kit', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const item = getItemByName(items, 'Horizon 130 Glass');
    expect(item).toBeDefined();
    expect(item?.name).toContain('Horizon 130 Glass Starter Kit');
    expect(item?.name).toContain('42+72cm');
    expect(item?.price).toBe(273.9);
  });

  it('preserves multiline name: Reflector Mini Touch LED', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const item = getItemByName(items, 'Reflector Mini Touch');
    expect(item).toBeDefined();
    expect(item?.name).toContain('Reflector Mini Touch LED');
    expect(item?.price).toBe(19.77);
  });

  it('extracts Cage Cover Suits D24, D36, D48', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(hasItemWithName(items, 'Cage Cover Suits D24')).toBe(true);
    expect(hasItemWithName(items, 'Cage Cover Suits D36')).toBe(true);
    expect(hasItemWithName(items, 'Cage Cover Suits D48')).toBe(true);
    const d24 = getItemByName(items, 'D24');
    const d36 = getItemByName(items, 'D36');
    const d48 = getItemByName(items, 'D48');
    expect(d24?.price).toBe(14.35);
    expect(d36?.price).toBe(21.82);
    expect(d48?.price).toBe(36.2);
  });

  it('extracts Assorted Dog Toys with Bonus Display Bin', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(hasItemWithName(items, 'Assorted Dog Toys')).toBe(true);
    const kit2516 = getItemByName(items, 'Assorted Dog Toys');
    expect(kit2516?.price).toBe(295);
    const kit2519 = items.find((i) => i.name.includes('Assorted') && i.price === 380);
    expect(kit2519).toBeDefined();
  });

  it('never returns "Product" as name', () => {
    const { items } = kongParser(KONG_SAMPLE);
    const productItems = items.filter((i) => i.name === 'Product');
    expect(productItems).toHaveLength(0);
  });

  it('returns legacy format with code, name, quantity, price', () => {
    const { items } = kongParser(KONG_SAMPLE);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.quantity).toBe('number');
      expect(item.quantity).toBeGreaterThanOrEqual(1);
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThanOrEqual(0);
    }
  });
});
