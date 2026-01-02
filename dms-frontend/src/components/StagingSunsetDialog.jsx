import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Link,
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

const PROD_ORIGIN = "https://caw-dms.com";

function isStagingHost(hostname) {
  return hostname === "staging.caw-dms.com" || hostname.startsWith("staging.");
}

export default function StagingSunsetDialog() {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const staging = isStagingHost(hostname);

  const prodHref = useMemo(() => {
    if (typeof window === "undefined") return PROD_ORIGIN;
    return `${PROD_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, []);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!staging) return;
    // show once per tab session
    const dismissed = sessionStorage.getItem("staging_sunset_dismissed");
    if (!dismissed) setOpen(true);
  }, [staging]);

  if (!staging) return null;

  const close = () => {
    sessionStorage.setItem("staging_sunset_dismissed", "1");
    setOpen(false);
  };

  const goProd = () => {
    window.location.href = prodHref;
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WarningAmberRoundedIcon color="warning" />
        Peringatan: domain staging akan dihentikan
      </DialogTitle>

      <DialogContent dividers>
        <Typography sx={{ lineHeight: 1.7 }}>
          Domain website ini akan dihentikan pada <b>20 Januari 2026</b>. Silahkan pindah
          ke{" "}
          <Link href={PROD_ORIGIN} target="_blank" rel="noopener noreferrer">
            caw-dms.com
          </Link>
          .
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={close}>Tetap di staging</Button>
        <Button variant="contained" onClick={goProd}>
          Pindah ke caw-dms.com
        </Button>
      </DialogActions>
    </Dialog>
  );
}

