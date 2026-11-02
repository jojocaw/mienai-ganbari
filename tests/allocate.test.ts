// F6: the split matches hand calculation to the yen, and the totals always add up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, AllocationError, UNITS, yen, type Unit } from "../src/lib/pay/allocate.ts";

const ORDER = ["a", "b", "c", "d"];

test("hand-calculated examples, to the yen", () => {
  // 50,000 by 2:1:1 → 25,000 / 12,500 / 12,500
  assert.deepEqual(allocate(50000, { a: 2, b: 1, c: 1 }, 1, ORDER).amounts, { a: 25000, b: 12500, c: 12500 });
  // 10,000 by 1:1:1 → 3,333.33… each; the 1 yen left goes to the first on the list
  assert.deepEqual(allocate(10000, { a: 1, b: 1, c: 1 }, 1, ORDER).amounts, { a: 3334, b: 3333, c: 3333 });
  // the same in 100-yen units → 100 units: 34 / 33 / 33
  assert.deepEqual(allocate(10000, { a: 1, b: 1, c: 1 }, 100, ORDER).amounts, { a: 3400, b: 3300, c: 3300 });
  // 7 yen by 3:0:2 → a 4.2, c 2.8 → floors 4 and 2, the last yen to c (larger remainder)
  assert.deepEqual(allocate(7, { a: 3, b: 0, c: 2 }, 1, ORDER).amounts, { a: 4, b: 0, c: 3 });
});

test("less than one unit stays with the shop and is shown as left over", () => {
  const r = allocate(10050, { a: 1, b: 1, c: 1 }, 100, ORDER);
  assert.deepEqual(r.amounts, { a: 3400, b: 3300, c: 3300 });
  assert.equal(r.distributed, 10000);
  assert.equal(r.leftover, 50);
});

test("ties go to the larger share, then to the order of the staff list", () => {
  // 10 yen by 1:1:2 → 2.5 / 2.5 / 5 → floors 2, 2, 5 and 1 yen left; a and b tie on remainder, a is first on the list
  assert.deepEqual(allocate(10, { a: 1, b: 1, c: 2 }, 1, ORDER).amounts, { a: 3, b: 2, c: 5 });
  // same, with b listed before a
  assert.deepEqual(allocate(10, { a: 1, b: 1, c: 2 }, 1, ["b", "a", "c"]).amounts, { b: 3, a: 2, c: 5 });
});

test("for any input: the sum adds up, amounts are whole units, zero share gets zero, a larger share never gets less", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 2000; i++) {
    const unit = UNITS[Math.floor(rand() * UNITS.length)] as Unit;
    const total = Math.floor(rand() * 200000);
    const shares: Record<string, number> = {};
    for (const id of ORDER) shares[id] = Math.floor(rand() * 4);
    if (Object.values(shares).every((s) => s === 0)) shares.a = 1;
    const r = allocate(total, shares, unit, ORDER);
    assert.equal(r.distributed + r.leftover, total);
    assert.ok(r.leftover >= 0 && r.leftover < unit);
    for (const id of ORDER) {
      assert.equal(r.amounts[id] % unit, 0);
      if (shares[id] === 0) assert.equal(r.amounts[id], 0);
      for (const other of ORDER) if (shares[id] > shares[other]) assert.ok(r.amounts[id] >= r.amounts[other]);
    }
  }
});

test("bad input is refused, never silently fixed", () => {
  assert.throws(() => allocate(1000, { a: 0, b: 0 }, 1, ORDER), AllocationError);
  assert.throws(() => allocate(1000, { a: -1, b: 2 }, 1, ORDER), AllocationError);
  assert.throws(() => allocate(1000, { a: 1.5 }, 1, ORDER), AllocationError);
  assert.throws(() => allocate(1000.5, { a: 1 }, 1, ORDER), AllocationError);
  assert.throws(() => allocate(1000, { zz: 1 }, 1, ORDER), AllocationError);
  assert.throws(() => allocate(1000, { a: 1 }, 5 as Unit, ORDER), AllocationError);
});

test("the amount text used in letters", () => {
  assert.equal(yen(12500), "12,500円");
  assert.equal(yen(0), "0円");
});
