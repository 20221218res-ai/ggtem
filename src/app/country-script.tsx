import Script from "next/script";

export default function CountryScript() {
  const script = `
    (function () {
      try {
        var country = window.localStorage.getItem("ggitem-country") || "KR";
        var allowed = ["KR", "CN", "VN", "PH", "TH"];
        var langs = {
          KR: "ko-KR",
          CN: "zh-CN",
          VN: "vi-VN",
          PH: "en-PH",
          TH: "th-TH"
        };
        if (allowed.indexOf(country) === -1) country = "KR";
        document.documentElement.dataset.country = country;
        document.documentElement.lang = langs[country] || "ko-KR";
      } catch (error) {
        document.documentElement.dataset.country = "KR";
        document.documentElement.lang = "ko-KR";
      }
    })();
  `;

  return (
    <Script id="ggitem-country-bootstrap" strategy="beforeInteractive">
      {script}
    </Script>
  );
}
