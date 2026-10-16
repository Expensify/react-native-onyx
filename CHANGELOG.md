# Changelog

## Unreleased

### Breaking changes

The native SQLite provider requires `react-native-nitro-sqlite` `^10.2.0`. NitroSQLite 9.x no longer satisfies Onyx's optional peer dependency. Upgrade NitroSQLite to 10.2.0 or a compatible 10.x release and rebuild your native app when upgrading Onyx.

The peer dependency remains optional for apps that use another storage provider.
