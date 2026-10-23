import { getRandomValues, randomUUID } from 'expo-crypto';

// LiveStore needs secure randomness before its modules initialize in Hermes.
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
globalThis.crypto.randomUUID ??= randomUUID as Crypto['randomUUID'];
