/**
 * Canonical greeting message list for the home page.
 *
 * Every name-free greeting from the README, tagged with the time-of-day
 * buckets and day-of-week buckets in which it is valid. Messages with no tags
 * are generic greetings, valid at any time on any day, and guarantee a
 * non-empty candidate pool for every hour and day.
 *
 * Time-of-day buckets (24-hour clock): night 0-4, morning 5-11, afternoon
 * 12-17, evening 18-21, night 22-23.
 * Day-of-week buckets: lowercase `mon`..`sun`.
 */

export type TimeBucket = "night" | "morning" | "afternoon" | "evening";

export type DayBucket = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface GreetingMessage {
  /** The full greeting text, rendered with no name appended. */
  message: string;
  /** Time-of-day buckets in which this greeting is valid. Omitted = any time. */
  time?: readonly TimeBucket[];
  /** Day-of-week buckets in which this greeting is valid. Omitted = any day. */
  days?: readonly DayBucket[];
}

export const GREETING_MESSAGES: readonly GreetingMessage[] = [
  // Generic - valid at any time on any day.
  { message: "Back at it!" },
  { message: "Hey there" },
  { message: "Hi, how are you?" },
  { message: "How's it going?" },
  { message: "Welcome" },
  { message: "What's new?" },
  { message: "What's on your mind?" },

  // Morning - 5-11.
  { message: "Good morning", time: ["morning"] },

  // Afternoon - 12-17.
  { message: "Good afternoon", time: ["afternoon"] },

  // Evening - 18-21.
  { message: "Evening", time: ["evening"] },
  { message: "Good evening", time: ["evening"] },
  { message: "How was your day?", time: ["evening"] },

  // Night - 0-4 and 22-23.
  { message: "Hello, night owl", time: ["night"] },
  { message: "What's on your mind tonight?", time: ["night"] },

  // Per-day.
  { message: "Happy Monday", days: ["mon"] },
  { message: "Happy Tuesday", days: ["tue"] },
  { message: "Happy Wednesday", days: ["wed"] },
  { message: "Happy Thursday", days: ["thu"] },
  { message: "Happy Friday", days: ["fri"] },
  { message: "That Friday feeling", days: ["fri"] },
  { message: "Happy Saturday!", days: ["sat"] },
  { message: "Happy Sunday", days: ["sun"] },
  { message: "Sunday session?", days: ["sun"] },
  { message: "Welcome to the weekend", days: ["sat", "sun"] },
];
