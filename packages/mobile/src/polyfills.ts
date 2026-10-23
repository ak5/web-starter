import 'fast-text-encoding';
import { getRandomValues, randomUUID } from 'expo-crypto';

// LiveStore needs UTF-8 and secure randomness before its modules initialize in Hermes.
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
globalThis.crypto.randomUUID ??= randomUUID as Crypto['randomUUID'];
