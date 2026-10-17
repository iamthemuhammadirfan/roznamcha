// The version people see in Settings. Bump it with every `eas update`.
//
// app.json's `version` (1.0.0) can't be used for this: it's part of the runtime
// fingerprint, so changing it makes a new runtime and over-the-air updates would stop
// reaching the APK already installed. It only changes with a new native build.
export const RELEASE = '1.2.2';
