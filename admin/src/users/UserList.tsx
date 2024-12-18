import * as React from "react";
import { useMediaQuery, Theme, Avatar, Stack, Box, Typography } from "@mui/material";
import { Datagrid, List, SimpleList, TextField, useRecordContext } from "react-admin";
import { isPubkeyWhitelisted } from '../../../src/helpers/whitelist.js';

function NumberOfBlobs() {
  const record = useRecordContext();
  return <p>{record.blobs.length} blobs</p>;
}
function UserProfile() {
  const record = useRecordContext();
  if (!record.profile) return null;
  return (
    <Stack direction="row" spacing={2} useFlexGap>
      <Avatar src={record.profile.image} />
      <Box>
        <Typography fontWeight="bold" margin={0}>
          {record.profile.name}
        </Typography>
        <Typography margin={0}>{record.profile.nip05}</Typography>
      </Box>
    </Stack>
  );
}
function WhitelistStatus() {
  const record = useRecordContext();
  const isWhitelisted = isPubkeyWhitelisted(record.pubkey);
  return <p>{isWhitelisted ? 'Yes' : 'No'}</p>;
}

export default function UserList() {
  return (
    <List sort={{ field: "pubkey", order: "ASC" }}>
      {useMediaQuery((theme: Theme) => theme.breakpoints.down("md")) ? (
        <SimpleList primaryText={(record) => record.pubkey} />
      ) : (
        <Datagrid optimized bulkActionButtons={<></>}>
          <UserProfile />
          <TextField source="pubkey" />
          <NumberOfBlobs />
          <WhitelistStatus />
        </Datagrid>
      )}
    </List>
  );
}
