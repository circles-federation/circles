import { beforeEach, describe, expect, it } from "vitest";
import { setAdmins } from "./applications";
import { addCircle, addMember, join, resetDb, setNotify } from "./testing";
import { getMemberPhoto, getMembers } from "./members";
import { approvePhoto, countPendingReviews, declinePhoto, getCurrentPhotoForReview, getPendingPhoto, getPendingPhotoVersion, getPhotoReview, getPhotoReviews, submitMemberPhoto } from "./photo-reviews";

// just the bytes a JPEG, PNG or WebP starts with: what's checked is the file's own signature
const JPEG = (tag = 1) => new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, tag])], { type: "image/jpeg" });
const PNG = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], { type: "image/png" });

const MEMBER = 2;
const ADMIN = 1;
const OTHER = 3;

beforeEach(async () => {
  await resetDb();
  for (const id of [ADMIN, MEMBER, OTHER, 4]) await addMember(id);
  await setAdmins(["m1@example.test"], true);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city", name: "The 903" });
  await join("the903", ADMIN, MEMBER, OTHER);
});

describe("sending a photo", () => {
  it("holds a member's new photo for review, and shows no one a live one yet", async () => {
    const result = await submitMemberPhoto(MEMBER, JPEG());
    expect(result).toHaveProperty("pending");
    expect(await getMemberPhoto(OTHER, MEMBER)).toBeNull();
    expect((await getMembers()).find((m) => m.id === MEMBER)?.photoVersion).toBeUndefined();
    expect(await getPendingPhotoVersion(MEMBER)).toBe((result as { pending: number }).pending);
  });

  it("puts an admin's own photo live at once", async () => {
    expect(await submitMemberPhoto(ADMIN, JPEG())).toHaveProperty("live");
    expect((await getMemberPhoto(OTHER, ADMIN))?.contentType).toBe("image/jpeg");
    expect(await getPendingPhotoVersion(ADMIN)).toBeUndefined();
  });

  it("replaces a photo still waiting with the newer one", async () => {
    await submitMemberPhoto(MEMBER, JPEG(1));
    await submitMemberPhoto(MEMBER, PNG);
    expect((await getPendingPhoto(MEMBER, MEMBER))?.contentType).toBe("image/png");
    expect(await getPhotoReviews(ADMIN)).toHaveLength(1);
  });

  it("refuses what isn't a photo, by its bytes rather than its declared type", async () => {
    await expect(submitMemberPhoto(MEMBER, new Blob(["<script>"], { type: "image/jpeg" }))).rejects.toThrow(/isn't a JPEG/);
    await expect(submitMemberPhoto(MEMBER, new Blob([]))).rejects.toThrow(/Choose a photo/);
    await expect(submitMemberPhoto(MEMBER, new Blob([Buffer.alloc(1024 * 1024 + 1, 0xff)]))).rejects.toThrow(/too large/);
  });
});

describe("who sees a waiting photo", () => {
  it("is the member and the admins only", async () => {
    await submitMemberPhoto(MEMBER, JPEG());
    expect(await getPendingPhoto(MEMBER, MEMBER)).not.toBeNull();
    expect(await getPendingPhoto(ADMIN, MEMBER)).not.toBeNull();
    expect(await getPendingPhoto(OTHER, MEMBER)).toBeNull();
  });

  it("shows an admin the photo it would replace, only while one is waiting, and no one else", async () => {
    await submitMemberPhoto(MEMBER, JPEG(1));
    const version = (await getPhotoReviews(ADMIN))[0]!.version;
    expect(await getCurrentPhotoForReview(ADMIN, MEMBER)).toBeNull();
    await approvePhoto(ADMIN, MEMBER, version);
    expect(await getCurrentPhotoForReview(ADMIN, MEMBER)).toBeNull();
    await submitMemberPhoto(MEMBER, JPEG(2));
    expect(await getCurrentPhotoForReview(ADMIN, MEMBER)).not.toBeNull();
    expect(await getCurrentPhotoForReview(OTHER, MEMBER)).toBeNull();
  });
});

describe("reviewing", () => {
  it("is for admins: the list, a single review and the count", async () => {
    await submitMemberPhoto(MEMBER, JPEG());
    await expect(getPhotoReviews(OTHER)).rejects.toThrow();
    await expect(getPhotoReview(OTHER, MEMBER)).rejects.toThrow();
    expect(await countPendingReviews(OTHER)).toBeNull();
    expect(await countPendingReviews(ADMIN)).toBe(1);
    expect(await getPhotoReview(ADMIN, MEMBER)).toMatchObject({ memberId: MEMBER, name: "Member 2", neighborhoodName: "The 903" });
    expect(await getPhotoReview(ADMIN, OTHER)).toBeNull();
  });

  it("makes an approved photo live and tells the member by email", async () => {
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG())) as { pending: number };
    expect(await approvePhoto(ADMIN, MEMBER, pending)).toEqual({ memberId: MEMBER, name: "Member 2", email: "m2@example.test" });
    expect((await getMemberPhoto(OTHER, MEMBER))?.contentType).toBe("image/jpeg");
    expect(await getPendingPhoto(MEMBER, MEMBER)).toBeNull();
    expect(await countPendingReviews(ADMIN)).toBe(0);
  });

  it("deletes a declined photo, keeps the old one, and passes on the note", async () => {
    await submitMemberPhoto(ADMIN, JPEG(9));
    const live = await getMemberPhoto(ADMIN, ADMIN);
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG())) as { pending: number };
    expect(await declinePhoto(ADMIN, MEMBER, pending, "  Please show your face  ")).toMatchObject({ memberId: MEMBER, note: "Please show your face" });
    expect(await getPendingPhoto(MEMBER, MEMBER)).toBeNull();
    expect(await getMemberPhoto(OTHER, MEMBER)).toBeNull();
    expect(await getMemberPhoto(ADMIN, ADMIN)).toEqual(live);
  });

  it("leaves out the address of a member who's turned email off", async () => {
    await setNotify(MEMBER, { email: false });
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG())) as { pending: number };
    expect(await approvePhoto(ADMIN, MEMBER, pending)).not.toHaveProperty("email");
  });

  it("refuses a decision by a non-admin, with nothing changed", async () => {
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG())) as { pending: number };
    await expect(approvePhoto(OTHER, MEMBER, pending)).rejects.toThrow();
    await expect(approvePhoto(MEMBER, MEMBER, pending)).rejects.toThrow();
    expect(await getPendingPhoto(MEMBER, MEMBER)).not.toBeNull();
  });

  it("refuses a decision on a photo the admin hasn't seen, or that's been decided", async () => {
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG(1))) as { pending: number };
    await new Promise((r) => setTimeout(r, 5));
    await submitMemberPhoto(MEMBER, JPEG(2));
    await expect(approvePhoto(ADMIN, MEMBER, pending)).rejects.toThrow(/different photo/);
    expect(await getMemberPhoto(OTHER, MEMBER)).toBeNull();
    const version = (await getPhotoReviews(ADMIN))[0]!.version;
    await approvePhoto(ADMIN, MEMBER, version);
    await expect(approvePhoto(ADMIN, MEMBER, version)).rejects.toThrow(/already been decided/);
  });

  it("limits the note's length", async () => {
    const { pending } = (await submitMemberPhoto(MEMBER, JPEG())) as { pending: number };
    await expect(declinePhoto(ADMIN, MEMBER, pending, "x".repeat(2000))).rejects.toThrow(/Keep the note/);
  });
});
