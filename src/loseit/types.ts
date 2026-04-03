// src/loseit/types.ts
//
// GWT type registrations for Lose It model classes.
// Field order is derived from captured GWT-RPC responses.
// Fields are serialized in Java declaration order, superclass first.

import { registerGwtType } from "./gwt.js";

export function registerLoseItTypes(): void {
  // --- GoalsData response types ---

  registerGwtType("com.loseit.core.client.model.GoalsData", [
    { name: "budgetContext", type: "object" },
    { name: "dailyEntries", type: "object" }, // array
    { name: "goalsSummary", type: "object" },
    { name: "weightEntries", type: "object" }, // array
    { name: "goalsProfile", type: "object" },
  ]);

  registerGwtType(
    "com.loseit.core.client.model.budget.DailyBudgetContext",
    [
      { name: "weight", type: "double" },
      { name: "budget", type: "double" },
      { name: "timezoneOffset", type: "int" },
      { name: "dayNumber", type: "int" },
      { name: "dayId", type: "string" },
      { name: "dateRef", type: "object" },
      { name: "weekId", type: "string" },
    ],
  );

  registerGwtType("com.loseit.core.client.model.DailyLogEntry", [
    { name: "weight", type: "double" },
    { name: "budget", type: "double" },
    { name: "timezoneOffset", type: "int" },
    { name: "dayNumber", type: "int" },
    { name: "dayId", type: "string" },
    { name: "dateRef", type: "object" },
    { name: "weekId", type: "string" },
    { name: "currentWeight", type: "double" },
    { name: "totalBudget", type: "double" },
    { name: "exerciseBonusType", type: "int" },
    { name: "exerciseBonusValue", type: "int" },
    { name: "baseBudget", type: "double" },
    { name: "budgetState", type: "int" },
    { name: "caloriesEaten", type: "double" },
    { name: "totalCaloriesEaten", type: "double" },
    { name: "exerciseCalories", type: "double" },
    { name: "exerciseMinutes", type: "double" },
  ]);

  registerGwtType("com.loseit.core.client.model.DailyLogGoalsState", [
    { name: "timezoneOffset", type: "int" },
    { name: "dayNumber", type: "int" },
    { name: "dayId", type: "string" },
    { name: "dateRef", type: "object" },
    { name: "weekId", type: "string" },
    { name: "complete", type: "boolean" },
    { name: "goalsType", type: "int" },
  ]);

  registerGwtType("com.loseit.core.client.model.RecordedWeight", [
    { name: "weight", type: "double" },
    { name: "dateString", type: "string" },
    { name: "timezoneOffset", type: "int" },
    { name: "dayNumber", type: "int" },
    { name: "dayId", type: "string" },
    { name: "dateRef", type: "object" },
    { name: "source", type: "string" },
  ]);

  registerGwtType("com.loseit.core.client.model.GoalsSummary", [
    { name: "currentWeight", type: "double" },
    { name: "goalWeight", type: "double" },
    { name: "goalPlan", type: "object" },
    { name: "activityLevel", type: "object" },
    { name: "gender", type: "object" },
    { name: "nutritionStrategy", type: "object" },
    { name: "budgetIdentifier", type: "object" },
    { name: "baseBudget", type: "double" },
  ]);

  // --- GoalsStatus / CustomGoal types ---

  registerGwtType("com.loseit.core.client.model.GoalsStatus", [
    { name: "customGoals", type: "object" }, // array
    { name: "goalsSummary", type: "object" },
  ]);

  registerGwtType("com.loseit.core.client.model.CustomGoal", [
    { name: "goalId", type: "string" },
    { name: "name", type: "string" },
    { name: "description", type: "string" },
    { name: "unit", type: "string" },
    { name: "targetValue", type: "double" },
    { name: "currentValue", type: "double" },
    { name: "goalType", type: "object" },
    { name: "measureFrequency", type: "object" },
    { name: "primaryKey", type: "object" },
    { name: "keyBytes", type: "byte_array" },
  ]);

  // --- Date/time helpers ---

  registerGwtType("java.util.Date", [
    { name: "timestamp", type: "long" },
  ]);

  registerGwtType("java.sql.Timestamp", [
    { name: "timestamp", type: "long" },
  ]);

  registerGwtType("com.loseit.core.shared.model.DayDate", [
    { name: "timezoneOffset", type: "int" },
    { name: "dayNumber", type: "int" },
    { name: "dayId", type: "string" },
    { name: "dateRef", type: "object" },
    { name: "weekId", type: "string" },
  ]);

  // --- Enums (serialized as int ordinal after class ref) ---

  registerGwtType(
    "com.loseit.core.client.model.interfaces.GoalsProfileActivityLevel",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.GoalsProfileGender",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.GoalsSummary$GoalsPlan",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.interfaces.NutritionStrategyType",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.budget.DailyBudgetIdentifier",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.CustomGoalType",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.CustomGoalMeasureFrequency",
    [{ name: "ordinal", type: "int" }],
  );

  registerGwtType(
    "com.loseit.core.client.model.interfaces.FoodLogEntryType",
    [{ name: "ordinal", type: "int" }],
  );

  // --- SimplePrimaryKey ---

  registerGwtType("com.loseit.core.client.model.SimplePrimaryKey", [
    { name: "keyBytes", type: "byte_array" },
  ]);

  // --- Collections ---
  // ArrayList and HashMap are handled specially in GwtReader,
  // but we register them so lookupGwtType recognizes them.

  registerGwtType("java.util.ArrayList", []);
  registerGwtType("com.google.common.collect.RegularImmutableSet", []);
  registerGwtType("java.util.HashMap", []);
}
