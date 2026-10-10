
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const downloadButton =
        document.querySelector("#desktopDownloadButton");

    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            window.alert(
                "TienHub Desktop is under development.\n\n" +
                "The official download button will appear here when the first version launches."
            );
        });
    }


    /* =====================================================
       SEARCH
    ====================================================== */

    const searchInput =
        document.querySelector("#downloadSearch");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            /*
             * Trang Downloads chưa có danh sách game để lọc.
             * Giữ ô tìm kiếm đồng bộ với header của TienHub.
             */
        });
    }


    /* =====================================================
       SMOOTH PAGE TRANSITION
    ====================================================== */

    document.querySelectorAll("a[href]").forEach((link) => {

        link.addEventListener("click", (event) => {

            if (
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const href =
                link.getAttribute("href");

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:")
            ) {
                return;
            }

            if (link.target === "_blank") {
                return;
            }

            let target;

            try {
                target =
                    new URL(
                        href,
                        window.location.href
                    );
            } catch {
                return;
            }

            if (
                target.origin !==
                window.location.origin
            ) {
                return;
            }

            event.preventDefault();

            document.body.classList.add(
                "page-leaving"
            );

            window.setTimeout(() => {
                window.location.href =
                    target.href;
            }, 180);

        });

    });

});
