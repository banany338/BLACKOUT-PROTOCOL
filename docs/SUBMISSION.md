# Current submission text

This is a draft to copy or adapt. No submission was sent by this change. Team names and member names are omitted at the user's request.

## Project name

BLACKOUT PROTOCOL

## Problem

A small organisation can lose access to several essential services when one shared email, phone or administrator becomes unavailable. A backup can fail at the same time if it depends on the account it is supposed to recover. Teams often have the pieces of a recovery plan but cannot see how they depend on each other or which work would stop.

## Solution

BLACKOUT PROTOCOL helps the team map its services, owners and recovery arrangements, then safely ask: “What happens if this account or phone is lost?” The same map shows affected work, recovery loops and missing prerequisites. The team can evaluate an independent fallback, assign preparation tasks and save a readable recovery reference.

An optional cooperative check uses a reviewed copy of the organisation's own map. The host approves participants and assigns their accounts. Each owner records simulated recovery steps; missing prerequisites and unconfirmed methods block those steps. The resulting summary gives the team specific preparations to confirm in real life.

Private plans are encrypted locally. Sharing a map is an explicit choice that excludes private notes, instructions, tasks, history and the workspace key. Shared rooms use reviewed metadata on a trusted local server.

## What is done and the goal

A working local application includes direct service editing, dependency/loss analysis, separate proposals, assigned preparation tasks, encrypted backup/restore, local Google Directory import, offline references and shared checks of the same map. The interface centres on the map and keeps detailed explanations in the guide.

The production build passes, alongside 41 unit/integration checks and nine browser journeys. Browser checks include actual downloads, restore, offline planning, saved-plan conflicts, mobile layout and a host with three independent participants in a shared check.

The next acceptance step is to confirm one real team's dependencies and verify that unfamiliar users can explain a useful weakness and preparation. Physical offline LAN use, portable-file compatibility and independent security review remain unverified. Recovery actions are simulated; no real provider account is recovered or automatically tested.

## Defence relevance

The project maps dependencies between services and supports preparation and coordination during account-access emergencies. Its output is an owned preparation and a recovery reference the team can keep independently of the accounts being modelled.

## Presentation

Use the [three-minute product walkthrough](DEMO.md): map → chosen loss → understandable gap → proposed preparation → owner/team check → saved reference. Lead with the organisation's recovery finding.

## Disclosure

AI assisted planning, implementation, debugging, tests and documentation. The application uses deterministic rules and requires no runtime AI service. Libraries are listed in [Sources](SOURCES.md). Mark pre-event work according to the event's rules once the dates are confirmed.
