"use client";

import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

type CustomDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  dialogOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CustomDialog({
  trigger,
  title,
  description,
  content,
  footer,
  dialogOpen,
  onOpenChange,
}: CustomDialogProps) {
  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
