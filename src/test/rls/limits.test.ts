import { afterAll, describe, expect, it } from "vitest";

import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
} from "../supabase-helpers";

describe("RLS + triggers: limits", () => {
  const cleanupIds: string[] = [];

  afterAll(async () => {
    for (const id of cleanupIds) {
      await deleteUser(id);
    }
  });

  it("max_clans blocks second clan for default user (max=1)", async () => {
    const user = await createTestUser({ displayName: "1-clan user" });
    cleanupIds.push(user.id);

    await createTestClan(user, { name: "First" });

    // Second insert should hit enforce_max_clans
    const { error } = await user.client.from("clans").insert({
      name: "Second",
      owner_id: user.id,
    });
    expect(error?.message).toMatch(/max_clans/i);
  });

  it("max_clans allows N clans when raised by platform admin", async () => {
    const user = await createTestUser({ displayName: "3-clan user", maxClans: 3 });
    cleanupIds.push(user.id);

    await createTestClan(user, { name: "C1" });
    await createTestClan(user, { name: "C2" });
    await createTestClan(user, { name: "C3" });

    const { error } = await user.client.from("clans").insert({
      name: "C4",
      owner_id: user.id,
    });
    expect(error?.message).toMatch(/max_clans/i);
  });

  it("max_persons blocks insert at limit", async () => {
    const user = await createTestUser({ displayName: "Limit owner" });
    cleanupIds.push(user.id);
    const clanId = await createTestClan(user, { maxPersons: 2 });

    await user.client.from("persons").insert({ clan_id: clanId, full_name: "P1", gender: "M" });
    await user.client.from("persons").insert({ clan_id: clanId, full_name: "P2", gender: "F" });

    const { error } = await user.client.from("persons").insert({
      clan_id: clanId,
      full_name: "P3",
      gender: "M",
    });
    expect(error?.message).toMatch(/max_persons/i);
  });

  it("max_editors blocks editors at limit, viewers free", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const member = await createTestUser({ displayName: "Editor1" });
    const blockedEditor = await createTestUser({ displayName: "Editor2" });
    const viewer = await createTestUser({ displayName: "Viewer" });
    cleanupIds.push(owner.id, member.id, blockedEditor.id, viewer.id);

    // max_editors = 1; owner is admin and does not consume an editor seat.
    const clanId = await createTestClan(owner, { maxEditors: 1 });

    // First editor seat succeeds.
    await addMember(clanId, member, "editor");

    // Second editor seat should fail.
    const { error: editorErr } = await owner.client
      .from("clan_members")
      .insert({ clan_id: clanId, user_id: blockedEditor.id, role: "editor" });

    expect(editorErr?.message).toMatch(/max_editors/i);

    // Viewer does not consume an editor seat and should be allowed.
    const { error: viewerErr } = await owner.client
      .from("clan_members")
      .insert({ clan_id: clanId, user_id: viewer.id, role: "viewer" });

    expect(viewerErr).toBeNull();
  });
});
