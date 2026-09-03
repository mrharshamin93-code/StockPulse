*** StockPulse Screener user-facing error hardening
*** Apply to branch: Financial-Datasets-Migration

--- src/pages/Screener.jsx
+++ src/pages/Screener.jsx
@@
         navigate(
           "/screener/results",
           {
             replace: true,
             state: {
               loading:
                 false,
               results: [],
               filters:
                 selectedFilters,
-              error:
-                error?.message ||
-                "Unable to run the stock screen.",
+              error:
+                "Unable to run the stock screen. Please try again.",
             },
           },
         );
@@
       } catch (error) {
         console.error(
           "Failed to save screen:",
           error,
         );

         showToast(
-          error?.message ||
-            "Failed to save screen.",
+          "Unable to save this screen. Please try again.",
         );
       } finally {
         setSaving(false);
       }

--- src/pages/ScreenerResults.jsx
+++ src/pages/ScreenerResults.jsx
@@
         } catch (
           loadError
         ) {
@@
           console.error(
             "Failed to load screener page:",
             loadError,
           );

           setError(
-            loadError
-              ?.message ||
-              "Unable to load screener results.",
+            "Unable to load screener results. Please try again.",
           );
@@
       } catch (
         addError
       ) {
         console.error(
           "Failed to add screener result to watchlist:",
           addError,
         );

         showToast(
-          addError
-            ?.message ||
-            "Failed to add to watchlist",
+          "Unable to add this stock to your watchlist. Please try again.",
         );
       } finally {
         setAddingTicker("");
       }
