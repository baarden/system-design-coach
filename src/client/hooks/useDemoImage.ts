import { useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "../components/ExcalidrawClient";
import demoImageUrl from "../assets/demo.png";

const DEMO_IMAGE_ID = "demo-image-file";
const DEMO_ELEMENT_ID = "demo-image-element";

// Original image dimensions for aspect ratio
const ORIGINAL_WIDTH = 1158;
const ORIGINAL_HEIGHT = 493;
const DISPLAY_WIDTH = 400;
const DISPLAY_HEIGHT = Math.round(
  DISPLAY_WIDTH * (ORIGINAL_HEIGHT / ORIGINAL_WIDTH)
);

export function useDemoImage() {
  const loadedRef = useRef(false);

  const loadDemoImageIfEmpty = useCallback(
    async (api: ExcalidrawImperativeAPI, initialElementCount: number) => {
      if (loadedRef.current || initialElementCount > 0) return;

      loadedRef.current = true;

      try {
        // Fetch and convert to data URL
        const response = await fetch(demoImageUrl);
        const blob = await response.blob();
        const dataURL = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Add the file
        api.addFiles([
          {
            id: DEMO_IMAGE_ID,
            mimeType: "image/png",
            dataURL,
            created: Date.now(),
          },
        ]);

        // Add the image element
        api.updateScene({
          elements: [
            {
              type: "image",
              id: DEMO_ELEMENT_ID,
              fileId: DEMO_IMAGE_ID,
              x: 100,
              y: 100,
              width: DISPLAY_WIDTH,
              height: DISPLAY_HEIGHT,
              status: "saved",
              scale: [1, 1],
              crop: null,
              strokeColor: "transparent",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              strokeStyle: "solid",
              roughness: 0,
              opacity: 100,
              angle: 0,
              seed: Math.floor(Math.random() * 100000),
              version: 1,
              versionNonce: Math.floor(Math.random() * 100000),
              isDeleted: false,
              groupIds: [],
              frameId: null,
              boundElements: null,
              updated: Date.now(),
              link: null,
              locked: false,
            },
          ],
        });
      } catch (error) {
        console.error("[Demo] Failed to load demo image:", error);
      }
    },
    []
  );

  return { loadDemoImageIfEmpty };
}
