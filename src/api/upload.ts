import { ParameterizedContext, Next, DefaultState } from "koa";
import HttpErrors from "http-errors";
import { BlobMetadata } from "blossom-server-sdk";
import dayjs from "dayjs";

import storage, { addFromUpload } from "../storage/index.js";
import { CommonState, getBlobDescriptor, log, router, saveAuthToken } from "./router.js";
import { getFileRule } from "../rules/index.js";
import { config, Rule } from "../config.js";
import { hasUsedToken, updateBlobAccess } from "../db/methods.js";
import { readUpload, removeUpload, saveFromUploadRequest } from "../storage/upload.js";
import { blobDB } from "../db/db.js";
import { isPubkeyWhitelisted } from '../helpers/whitelist.js';

export type UploadState = CommonState & {
  contentType: string;
  contentLength: string;
  rule: Rule;
};

export function checkUpload(opts: { requireAuth: boolean; requirePubkeyInRule: boolean }) {
  return async (ctx: ParameterizedContext<DefaultState & CommonState>, next: Next) => {
    if (ctx.method === "HEAD" || ctx.method === "PUT") {
      // check auth
      if (opts.requireAuth) {
        if (!ctx.state.auth) throw new HttpErrors.Unauthorized("Missing Auth event");
        if (ctx.state.authType !== "upload") throw new HttpErrors.Unauthorized("Auth event should be 'upload'");
        if (hasUsedToken(ctx.state.auth.id)) throw new HttpErrors.BadRequest("Auth event already used");

        // BUD-06, check if hash is in auth event
        const sha256 = ctx.header["x-sha-256"];
        if (typeof sha256 === "string" && !ctx.state.auth.tags.some((t) => t[0] === "x" && t[1] === sha256)) {
          throw new HttpErrors.BadRequest("Auth missing sha256");
        }
      }

      // check rules
      const contentType = ctx.header["content-type"] || String(ctx.header["x-content-type"]);
      let contentLength: number | undefined = undefined;
      if (typeof ctx.header["x-content-length"] === "string") {
        contentLength = parseInt(ctx.header["x-content-length"]);
      } else if (ctx.header["content-length"]) {
        contentLength = parseInt(ctx.header["content-length"]);
      }

      const pubkey = ctx.state.auth?.pubkey;
      const rule = getFileRule(
        {
          type: contentType,
          pubkey,
        },
        config.storage.rules,
        opts.requireAuth && opts.requirePubkeyInRule,
      );

      if (!rule) {
        if (opts.requirePubkeyInRule) throw new HttpErrors.Unauthorized("Pubkey not on whitelist");
        else throw new HttpErrors.Unauthorized(`Server dose not accept ${contentType} blobs`);
      }

      ctx.state.contentType = contentType;
      ctx.state.contentLength = contentLength;
      ctx.state.rule = rule;
    }

    return await next();
  };
}

router.all<CommonState>(
  "/upload",
  async (ctx, next) => {
    if (!config.upload.enabled) throw new HttpErrors.NotFound("Uploads disabled");
    return await next();
  },
  checkUpload(config.upload),
);
router.head<UploadState>("/upload", async (ctx) => {
  ctx.status = 200;
});

router.put<UploadState>("/upload", async (ctx) => {
  const pubkey = ctx.state.auth?.pubkey;
  if (!pubkey || !isPubkeyWhitelisted(pubkey)) {
    throw new HttpErrors.Forbidden("User is not a Premium Azzamo Member. Get premium at azzamo.net/pay.");
  }

  const { contentType } = ctx.state;

  let upload = await saveFromUploadRequest(ctx.req);
  let type = contentType || upload.type;

  try {
    // if auth is required, check to see if the sha256 is in the auth event
    if (
      config.upload.requireAuth &&
      (!ctx.state.auth || !ctx.state.auth.tags.some((t) => t[0] === "x" && t[1] === upload.sha256))
    ) {
      throw new HttpErrors.BadRequest("Incorrect blob sha256");
    }

    const blob = await addFromUpload(upload, type);

    // add owner
    if (ctx.state.auth?.pubkey && !blobDB.hasOwner(upload.sha256, ctx.state.auth.pubkey)) {
      blobDB.addOwner(blob.sha256, ctx.state.auth.pubkey);
    }

    if (ctx.state.auth) saveAuthToken(ctx.state.auth);

    ctx.status = 200;
    ctx.body = getBlobDescriptor(blob, ctx.request);
  } catch (error) {
    // upload failed, cleanup temp file
    await removeUpload(upload);
    throw error;
  }
});

