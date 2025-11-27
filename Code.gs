const ACCOUNT_ID = "XXXXX";
const SHEET_NAME = "DeleteList";

function deleteContainersFromSheet() {
  const token = ScriptApp.getOAuthToken();

  // Read sheet list
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const values = sheet.getRange("A2:A" + sheet.getLastRow()).getValues();
  const namesToDelete = values
    .flat()
    .map(v => String(v).trim().toLowerCase())
    .filter(v => v !== "");

  Logger.log("Names to delete: " + JSON.stringify(namesToDelete));

  // Fetch containers
  const listUrl = `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers`;
  const listResponse = UrlFetchApp.fetch(listUrl, {
    method: "get",
    headers: { Authorization: `Bearer ${token}` }
  });

  const containers = JSON.parse(listResponse.getContentText()).container;
  if (!containers) return;

  containers.forEach((container, index) => {
    const nameLower = container.name.toLowerCase();

    const shouldDelete = namesToDelete.some(sheetName =>
      nameLower.includes(sheetName)
    );

    if (shouldDelete) {
      const deleteUrl = `https://tagmanager.googleapis.com/tagmanager/v2/${container.path}`;

      Logger.log(`Deleting: ${container.name}`);

      let success = false;
      let attempts = 0;

      while (!success && attempts < 5) {
        attempts++;

        const resp = UrlFetchApp.fetch(deleteUrl, {
          method: "delete",
          headers: { Authorization: `Bearer ${token}` },
          muteHttpExceptions: true,
        });

        const code = resp.getResponseCode();

        if (code === 200 || code === 204) {
          Logger.log(`✔ Deleted: ${container.name}`);
          success = true;
          break;
        }

        if (code === 429) {
          Logger.log(`⏳ 429 received. Waiting 5 seconds... attempt ${attempts}`);
          Utilities.sleep(5000); // wait 5 seconds and retry
        } else {
          Logger.log(`❌ Failed: ${resp.getContentText()}`);
          break;
        }
      }

      // Normal delay between deletions
      Utilities.sleep(3000);
    }
  });
}
