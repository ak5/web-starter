# @ak5/mobile

React Native with Expo SDK 58. The checked-in iOS and Android projects own native
configuration and signing. Expo CLI, Metro, and Expo autolinking build them. The
app includes account registration and login, verification and resend, password
recovery by email, secure session restore and sign-out, paginated JSON items,
and local-first notes.

## Setup

Install workspace tools with `mise install`, then run `pnpm install` and
`pnpm build:libs` at the root. Install Xcode and an iOS simulator for iOS, or
Android SDK 37, an emulator and JDK 25 for Android. The mise configuration
selects Ruby 4 and Java 25. For iOS, run `bundle install` from this package and
`pnpm app:pods` from the workspace root. Keep code signing enabled for iOS
simulator runtime checks so the app can access its Keychain group. The entitlement
uses the build's application identifier.

Android debug builds need a local `android/app/debug.keystore`. From this
package, create it if it is missing:

```sh
keytool -genkeypair -storetype PKCS12 -keystore android/app/debug.keystore \
  -storepass android -alias androiddebugkey -keypass android \
  -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
```

To distribute the app, configure your bundle identifier, signing, store metadata,
and application policies. Both projects use the example ID `com.ak5.mobile`.
The native projects preserve the iOS scene and the Android backup settings.
Rebuild the app after changes to native dependencies or their configuration.

## Develop

From the workspace root, run `pnpm dev:auto` for the local API and email mock.
In a second terminal run `pnpm dev:app`. It picks a free Metro port in
8081–8099 and records it in `packages/mobile/.env.dev-slot`. With your simulator
or emulator available, run `pnpm app:ios` or `pnpm app:android` to build and open
the app against that server. Stop Metro after verification.

`EXPO_PUBLIC_MOBILE_API_URL` is the public build-time API origin. The workspace
commands also accept `MOBILE_API_URL` in this package's `.env` or the shell. By
default they use the API port in the root `.env.dev-slot` and connect through
`127.0.0.1` on the iOS simulator or `10.0.2.2` on the Android emulator. Use
a reachable HTTPS API origin for physical devices and release builds. Keep
credentials out of JavaScript configuration.

After configuring release signing and the HTTPS origin, use
`pnpm --filter @ak5/mobile ios:release` or the corresponding `android:release`
command. Backend promotion and mobile distribution are separate.

## Verify

```sh
nice -n 10 pnpm check:mobile
nice -n 10 pnpm build:mobile
```

The bundle check runs Metro with one worker and compiles both outputs with
Hermes. On each platform, use the local API and a disposable test account to
check the native app itself:

1. Launch the app, register an account and use the PIN from the local email
   mock. Test resend, password recovery, and sign-in.
2. Open **Online items / verify email**. Create a JSON object, edit it, refresh
   and page through items, then confirm deletion. Check that invalid JSON shows
   an error and that fields and controls are reachable with the keyboard open.
3. Open **Offline notes** and add a note. Go offline and create or edit another
   note. Force-quit and reopen the app. Confirm the session and note survive.
   Reconnect and confirm that the note appears on the web under the same account.
   Sign out, sign in as another account, and confirm its notes are isolated.
4. For an in-place update, build and sign both versions with the same app ID and
   credentials. Install the update over the previous app without uninstalling.
   Reopen while offline and confirm the saved session and an unsynced note both
   survive. Reconnect and check that the note syncs.

Use a build with an embedded bundle for a cold launch with networking disabled.
With a Metro development build, disconnect the API while keeping Metro reachable.

## Boundaries

`App.tsx` and `src/LocalNotes.tsx` render native controls. The typed Hono client
in `src/client.ts` imports only API types and the shared cookie constant.
`src/storage.ts` persists credentials through Expo SecureStore using the operating
system's Keychain or Keystore. Notes share schema and sync logic with the web
app through `@ak5/sync`, with Expo SQLite as the native storage adapter.
See [local-first notes](../../docs/architecture/local-first.md) for account
isolation and retained data after sign-out.
