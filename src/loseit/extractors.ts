/**
 * Targeted extraction functions for GWT-RPC responses.
 *
 * GWT-RPC serializes depth-first, right-to-left. Inner/leaf data appears at
 * the START of the values array; wrapper objects appear at the END.
 */

import { dayNumberToDate, type GwtResponse } from "./gwt.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayNumberToDateString(dayNumber: number): string {
  const d = dayNumberToDate(dayNumber);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isDayNumber(n: unknown): n is number {
  return typeof n === "number" && n >= 7000 && n <= 11000;
}

function isWeight(n: unknown): n is number {
  return typeof n === "number" && n >= 50 && n <= 500;
}

function findStringRef(stringTable: string[], prefix: string): number {
  const idx = stringTable.findIndex((s) => s.startsWith(prefix));
  return idx >= 0 ? idx + 1 : -1;
}

// ---------------------------------------------------------------------------
// getGoalsData -> Daily Summary
// ---------------------------------------------------------------------------

export interface DailyEntry {
  date: string;
  dayNumber: number;
  weight: number;
  totalBudget: number;
  caloriesEaten: number;
  totalCaloriesEaten: number;
  exerciseCalories: number;
}

export interface DailySummaryResult {
  date: string;
  dayNumber: number;
  weight: number;
  caloriesBudget: number;
  caloriesEaten: number;
  caloriesRemaining: number;
  exerciseCalories: number;
  weekEntries: DailyEntry[];
}

/**
 * Extract daily summary from getGoalsData response.
 *
 * Each day number appears twice (DailyLogEntry + DailyLogGoalsState), ~16
 * positions apart. From the first dayNumber at position X:
 *   X+5: currentWeight, X+6: totalBudget
 *   X+11: caloriesEaten, X+12: totalCaloriesEaten
 *   X+13: exerciseCalories, X+14: exerciseMinutes
 *   X+16: same dayNumber (confirms match)
 */
export function extractDailySummary(
  raw: GwtResponse,
  targetDayNumber: number,
): DailySummaryResult | null {
  const { values } = raw;
  const entries: DailyEntry[] = [];
  const seenDays = new Set<number>();

  for (let i = 0; i < values.length - 16; i++) {
    const val = values[i];
    if (!isDayNumber(val)) continue;

    const tz = values[i - 1];
    const dayId = values[i + 1];
    if (typeof tz !== "number" || tz < -12 || tz > 14) continue;
    if (typeof dayId !== "string") continue;
    if (values[i + 16] !== val) continue;

    const dayNumber = val;
    if (seenDays.has(dayNumber)) continue;
    seenDays.add(dayNumber);

    const weight = values[i + 5];
    const totalBudget = values[i + 6];
    const caloriesEaten = values[i + 11];
    const totalCaloriesEaten = values[i + 12];
    const exerciseCalories = values[i + 13];

    if (typeof totalBudget !== "number") continue;
    if (typeof caloriesEaten !== "number") continue;

    entries.push({
      date: dayNumberToDateString(dayNumber),
      dayNumber,
      weight: isWeight(weight) ? weight : 0,
      totalBudget: Math.round(totalBudget * 100) / 100,
      caloriesEaten: Math.round(caloriesEaten),
      totalCaloriesEaten: Math.round(
        typeof totalCaloriesEaten === "number" ? totalCaloriesEaten : caloriesEaten,
      ),
      exerciseCalories: Math.round(
        typeof exerciseCalories === "number" ? exerciseCalories : 0,
      ),
    });
  }

  entries.sort((a, b) => a.dayNumber - b.dayNumber);

  const target = entries.find((e) => e.dayNumber === targetDayNumber);
  if (!target && entries.length === 0) return null;

  const effective = target ?? entries[entries.length - 1]!;

  return {
    date: effective.date,
    dayNumber: effective.dayNumber,
    weight: effective.weight,
    caloriesBudget: Math.round(effective.totalBudget),
    caloriesEaten: effective.caloriesEaten,
    caloriesRemaining: Math.round(effective.totalBudget) - effective.caloriesEaten,
    exerciseCalories: effective.exerciseCalories,
    weekEntries: entries,
  };
}

// ---------------------------------------------------------------------------
// getGoalsData -> Weight History
// ---------------------------------------------------------------------------

export interface WeightEntry {
  date: string;
  dayNumber: number;
  weight: number;
}

export interface WeightHistoryResult {
  currentWeight: number | null;
  goalWeight: number | null;
  baseBudget: number | null;
  entries: WeightEntry[];
}

/**
 * Extract weight history from getGoalsData response.
 *
 * RecordedWeight entries are identified by the RecordedWeight class ref.
 * Pattern: ..., tz, dayNumber, dayId, DateRef, DayDateRef, RecordedWeightRef, weight, ...
 *
 * GoalsSummary contains currentWeight, goalWeight, baseBudget. We find these
 * by looking for the pattern: currentWeight(187.4), baseBudget(2050) near the
 * GoalsSummary class ref.
 */
export function extractWeightHistory(raw: GwtResponse): WeightHistoryResult {
  const { values, stringTable } = raw;

  const recordedWeightRef = findStringRef(stringTable, "com.loseit.core.client.model.RecordedWeight/");
  const goalsSummaryRef = findStringRef(stringTable, "com.loseit.core.client.model.GoalsSummary/");

  const entries: WeightEntry[] = [];
  const seenDays = new Set<number>();

  // Find RecordedWeight entries
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] !== recordedWeightRef) continue;

    const weight = values[i + 1];
    if (!isWeight(weight)) continue;

    // Look backwards for the day number
    let dayNumber: number | null = null;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if (isDayNumber(values[j])) {
        dayNumber = values[j] as number;
        break;
      }
    }

    if (dayNumber === null || seenDays.has(dayNumber)) continue;
    seenDays.add(dayNumber);

    entries.push({
      date: dayNumberToDateString(dayNumber),
      dayNumber,
      weight,
    });
  }

  // Find GoalsSummary data: look for GoalsSummary class ref, then find
  // currentWeight and goalWeight nearby.
  //
  // The GoalsSummary fields are serialized LEFT of (before) the class ref
  // in the values array. The pattern near the ref:
  //   ... currentWeight, baseBudget, ... [enum objects] ..., GoalsSummaryRef
  //
  // We find them by scanning LEFT from GoalsSummaryRef for weight-like
  // doubles and the baseBudget value.
  let currentWeight: number | null = null;
  let goalWeight: number | null = null;
  let baseBudget: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (values[i] !== goalsSummaryRef) continue;

    // Scan left for weight values and budget
    // The GoalsSummary has: currentWeight, goalWeight, then nested objects,
    // then baseBudget. In the serialized array, baseBudget appears FIRST
    // (leftmost) since it's the last field and GWT reads right-to-left.
    //
    // Pattern observed in data:
    //   ... 187.4(cw), 2050(baseBudget), Double, ..., GoalsSummaryRef
    // And goalWeight(179) appears somewhere between.

    // Collect all weight-like values and budget-like values in the 30
    // positions to the left
    const weights: Array<{ value: number; pos: number }> = [];
    const budgets: Array<{ value: number; pos: number }> = [];

    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      const v = values[j];
      if (typeof v !== "number") continue;
      if (isWeight(v)) {
        weights.push({ value: v, pos: j });
      } else if (v >= 1000 && v <= 5000) {
        budgets.push({ value: v, pos: j });
      }
    }

    // The currentWeight should be the weight closest to the ref (rightmost)
    if (weights.length >= 1) {
      currentWeight = weights[0]!.value; // closest to ref
    }

    // The goalWeight should be the next weight value
    // It might also appear as an integer near other values
    // Scan for a reasonable goalWeight (100-300 range) that's different
    // from currentWeight
    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      const v = values[j];
      if (typeof v === "number" && v >= 100 && v <= 400 && v !== currentWeight) {
        goalWeight = v;
        break;
      }
    }

    if (budgets.length >= 1) {
      baseBudget = budgets[0]!.value;
    }

    break;
  }

  entries.sort((a, b) => b.dayNumber - a.dayNumber);

  return { currentWeight, goalWeight, baseBudget, entries };
}

// ---------------------------------------------------------------------------
// getGoalsStatus -> Goals
// ---------------------------------------------------------------------------

export interface GoalEntry {
  name: string;
  description: string;
  unit: string;
  goalId: string;
  targetValue: number;
  currentValue: number;
}

export interface GoalsResult {
  goals: GoalEntry[];
  currentWeight: number | null;
  goalWeight: number | null;
}

/**
 * Extract goals from getGoalsStatus response.
 *
 * Each goal name appears in a recognizable context:
 *   ..., 8(doubleRef), currentWrapped, 8(doubleRef), "",
 *   nameRef, backRef, unitIdRef, target, target, ...
 *   descriptionRef, 0, currentValue, ...
 *
 * Name at position P:
 *   P-1: "" (empty string ref)
 *   P+1: back-ref (negative number)
 *   P+2: unitId ref
 *   P+3, P+4: target value (duplicated)
 *   Then ahead: descriptionRef, 0, currentValue
 */
export function extractGoals(raw: GwtResponse): GoalsResult {
  const { values, stringTable } = raw;

  const goalNames = [
    "Fat", "Protein", "Carbohydrates", "Fiber", "Sodium", "Steps",
    "Apple Activity Move Goal", "Apple Activity Exercise Goal",
    "Apple Activity Stand Goal",
  ];

  const goalNameRefs = new Map<number, string>();
  for (const name of goalNames) {
    const idx = stringTable.indexOf(name);
    if (idx >= 0) goalNameRefs.set(idx + 1, name);
  }

  const unitIdToUnit: Record<string, string> = {
    fatgrams: "g", fatgms: "g",
    protgrams: "g", protgms: "g",
    carbgrams: "g", carbgms: "g",
    fiber: "g",
    sod: "mg",
    steps: "steps",
    excal: "cal",
    exmin: "min",
    aplmove: "",
    aplexer: "",
    aplstand: "",
  };

  const classPattern = /^(com\.|java\.|org\.|net\.|\[L|\[B)/;
  const descriptionRefs = new Map<number, string>();
  for (let i = 0; i < stringTable.length; i++) {
    const s = stringTable[i]!;
    if (s.startsWith("Consume ") || s.startsWith("Complete ") || s.startsWith("Take ")) {
      descriptionRefs.set(i + 1, s);
    }
  }

  const emptyStrRef = stringTable.indexOf("") + 1;

  const goals: GoalEntry[] = [];
  const seenNames = new Set<string>();

  for (let i = 2; i < values.length - 5; i++) {
    const ref = values[i];
    if (typeof ref !== "number") continue;
    const name = goalNameRefs.get(ref);
    if (!name) continue;

    // Verify context: P-1 should be empty string ref
    if (values[i - 1] !== emptyStrRef && values[i - 1] !== 0) continue;

    // P+1 should be negative (back-ref) or 0
    const afterName = values[i + 1];
    if (typeof afterName !== "number" || afterName > 0) continue;

    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // Two patterns exist for goal data:
    //
    // Pattern A (most goals): P+1 is back-ref (<0)
    //   P+2: unitIdRef, P+3: target, P+4: target(dup)
    //
    // Pattern B (Fat, last goal): P+1 is 0
    //   P+2: CustomGoalMeasureFrequency class ref
    //   P+3: unitIdRef("fatgrams"), P+4: target, P+5: target(dup)

    let unitId = "";
    let unit = "";
    let targetValue = 0;

    if (afterName === 0) {
      // Pattern B: shifted by 1
      const unitRef = values[i + 3];
      if (typeof unitRef === "number" && unitRef > 0 && unitRef <= stringTable.length) {
        const s = stringTable[unitRef - 1]!;
        if (!classPattern.test(s)) {
          unitId = s;
          unit = unitIdToUnit[s] ?? s;
        }
      }
      const t1 = values[i + 4];
      const t2 = values[i + 5];
      if (typeof t1 === "number" && t1 >= 0 && typeof t2 === "number" && t1 === t2) {
        targetValue = t1;
      }
    } else {
      // Pattern A
      const unitRef = values[i + 2];
      if (typeof unitRef === "number" && unitRef > 0 && unitRef <= stringTable.length) {
        const s = stringTable[unitRef - 1]!;
        if (!classPattern.test(s)) {
          unitId = s;
          unit = unitIdToUnit[s] ?? s;
        }
      }
      const t1 = values[i + 3];
      const t2 = values[i + 4];
      if (typeof t1 === "number" && t1 >= 0 && typeof t2 === "number" && t1 === t2) {
        targetValue = t1;
      } else if (typeof t1 === "number" && t1 >= 0) {
        targetValue = t1;
      }
    }

    // Find description and current value by scanning forward
    let description = "";
    let currentValue = 0;

    for (let j = i + 4; j < Math.min(i + 30, values.length - 2); j++) {
      const dRef = values[j];
      if (typeof dRef === "number" && descriptionRefs.has(dRef)) {
        description = descriptionRefs.get(dRef)!;
        if (values[j + 1] === 0 && typeof values[j + 2] === "number") {
          currentValue = values[j + 2] as number;
        }
        break;
      }
    }

    goals.push({
      name,
      description,
      unit,
      goalId: unitId,
      targetValue: Math.round(targetValue * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
    });
  }

  // Extract GoalsSummary for current/goal weight
  const goalsSummaryRef = findStringRef(stringTable, "com.loseit.core.client.model.GoalsSummary/");
  let currentWeight: number | null = null;
  let goalWeight: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (values[i] !== goalsSummaryRef) continue;

    const weights: number[] = [];
    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      const v = values[j];
      if (isWeight(v)) weights.push(v);
    }
    if (weights.length >= 1) currentWeight = weights[0]!;

    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      const v = values[j];
      if (typeof v === "number" && v >= 100 && v <= 400 && v !== currentWeight) {
        goalWeight = v;
        break;
      }
    }
    break;
  }

  return { goals, currentWeight, goalWeight };
}

// ---------------------------------------------------------------------------
// getInitializationData -> Food Log
// ---------------------------------------------------------------------------

export interface FoodLogItem {
  name: string;
  brand: string;
}

export interface FoodLogResult {
  date: string;
  entries: FoodLogItem[];
}

/**
 * Extract food log from getInitializationData response.
 *
 * Food entries are identified by the FoodIdentifier class ref pattern.
 * Each FoodIdentifier (reading left-to-right in the array) appears as:
 *   brand(ref), name(ref), 0, category(ref), backRef(-1), FoodIdentifier(ref)
 *
 * The FoodIdentifier is followed by FoodLogEntry(ref), then other objects.
 * The associated FoodServing calorie data appears earlier in the array
 * (since GWT serializes depth-first right-to-left).
 *
 * Each FoodServing data block has: entryId(string), servingId(string), 0,
 * numServings, numServings, servingAmount, ..., FoodServingSizeRef,
 * caloriesPerServing, doubleRef, ...
 */
export function extractFoodLog(
  raw: GwtResponse,
  targetDayNumber: number,
): FoodLogResult {
  const { values, stringTable } = raw;

  const foodIdentifierRef = findStringRef(stringTable, "com.loseit.core.client.model.FoodIdentifier/");
  const foodLogEntryRef = findStringRef(stringTable, "com.loseit.core.client.model.FoodLogEntry/");

  const classPattern = /^(com\.|java\.|org\.|net\.|\[L|\[B)/;
  // The username is always at string table index 3 (0-indexed)
  const username = stringTable[3] ?? "";
  const skipStrings = new Set([
    "Default", username, "",
    "fatgrams", "fatgms", "protgrams", "protgms", "carbgrams", "carbgms",
    "fiber", "sod", "steps", "excal", "exmin", "aplmove", "aplexer", "aplstand",
    "Fat", "Protein", "Carbohydrates", "Fiber", "Sodium", "Steps",
    "Apple Activity Move Goal", "Apple Activity Exercise Goal",
    "Apple Activity Stand Goal",
  ]);

  function isFoodName(ref: number): boolean {
    if (ref < 1 || ref > stringTable.length) return false;
    const s = stringTable[ref - 1]!;
    return s.length > 0 && !classPattern.test(s) && !skipStrings.has(s);
  }

  // Find all FoodIdentifier positions.
  // Pattern: brand(ref), name(ref), 0, category(ref), backRef, FoodIdentifier(ref), FoodLogEntry(ref)
  interface FoodEntryPos {
    name: string;
    brand: string;
    pos: number;
  }

  const foodEntryPositions: FoodEntryPos[] = [];

  for (let i = 5; i < values.length - 1; i++) {
    if (values[i] !== foodIdentifierRef) continue;
    if (values[i + 1] !== foodLogEntryRef) continue;

    const backRef = values[i - 1];
    if (typeof backRef !== "number" || backRef > 0) continue;

    let category = "";
    let name = "";
    let brand = "";

    const catRef = values[i - 2];
    if (typeof catRef === "number" && isFoodName(catRef)) {
      category = stringTable[catRef - 1]!;
    }

    if (values[i - 3] === 0) {
      const nameRef = values[i - 4];
      if (typeof nameRef === "number" && isFoodName(nameRef)) {
        name = stringTable[nameRef - 1]!;
      }
      const brandRef = values[i - 5];
      if (typeof brandRef === "number" && isFoodName(brandRef)) {
        brand = stringTable[brandRef - 1]!;
      }
    }

    if (!name && category) {
      name = category;
      category = "";
    }

    if (name) {
      foodEntryPositions.push({ name, brand, pos: i });
    }
  }

  // Filter to entries for the target day.
  // The target day number appears after each food entry block.
  const targetDayPositions: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === targetDayNumber) targetDayPositions.push(i);
  }

  const entries: FoodLogItem[] = [];
  const seenNames = new Set<string>();

  for (const food of foodEntryPositions) {
    const isTargetDay = targetDayPositions.some(
      (p) => p > food.pos && p < food.pos + 80,
    );
    if (!isTargetDay) continue;

    // Deduplicate by name+brand (same food may appear in multiple sections)
    const key = `${food.name}|${food.brand}`;
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    entries.push({
      name: food.name,
      brand: food.brand,
    });
  }

  return {
    date: dayNumberToDateString(targetDayNumber),
    entries,
  };
}
