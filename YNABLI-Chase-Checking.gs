// ==============================================
// YNABLI (YNAB Live Importer) for Chase Checking
// ==============================================

const scriptProps = PropertiesService.getScriptProperties();

// YNAB properties that need to be retrieved from YNAB API settings and YNAB URL for your budget & account.
// You need to get the property values from YNAB and create Script Properties for this script.
// There is no need to put any sensitive information inside this script.
const accessToken = scriptProps.getProperty("ACCESS_TOKEN");
const budgetID = scriptProps.getProperty("BUDGET_ID");
const accountID = scriptProps.getProperty("ACCOUNT_ID");

// Last four digits of your Chase bank account number which is connected with accountID on YNAB.
const last4AcctNum = scriptProps.getProperty("LAST4_ACCT_NUM");

// ==============================================
// Helper functions
// ==============================================

function monthToNum(month) {
  if (month.indexOf("Jan") > -1 || month.indexOf("January") > -1) {
    return  1;
  } else if (month.indexOf("Feb") > -1 || month.indexOf("February") > -1) {
    return  2;
  } else if (month.indexOf("Mar") > -1 || month.indexOf("March") > -1) {
    return  3;
  } else if (month.indexOf("Apr") > -1 || month.indexOf("April") > -1) {
    return  4;
  } else if (month.indexOf("May") > -1) {
    return  5;
  } else if (month.indexOf("Jun") > -1 || month.indexOf("June") > -1) {
    return  6;
  } else if (month.indexOf("Jul") > -1 || month.indexOf("July") > -1) {
    return  7;
  } else if (month.indexOf("Aug") > -1 || month.indexOf("August") > -1) {
    return  8;
  } else if (month.indexOf("Sep") > -1 || month.indexOf("September") > -1) {
    return  9;
  } else if (month.indexOf("Oct") > -1 || month.indexOf("October") > -1) {
    return  10;
  } else if (month.indexOf("Nov") > -1 || month.indexOf("November") > -1) {
    return  11;
  } else if (month.indexOf("Dec") > -1 || month.indexOf("December") > -1) {
    return  12;
  }
}

function numToMonth(num) {
  switch (num) {
    case 1:
      return "January"
    case 2:
      return "February";
    case 3:
      return "March";
    case 4:
      return "April";
    case 5:
      return "May";
    case 6:
      return "June";
    case 7:
      return "July";
    case 8:
      return "August";
    case 9:
      return "September";
    case 10:
      return "October";
    case 11:
      return "November";
    case 12:
      return "December";
  }
}

function getPrevDate(curDate, offset) {
  // Get the ISO date of offset days from curDate.
  var curDateSplit = curDate.split("-");
  var curYear = curDateSplit[0]
  var curMonth = curDateSplit[1]
  var curDay = curDateSplit[2]
  var curDateStr = numToMonth(+curMonth) + " " + curDay + ", " + curYear;
  var curDateObj = new Date(curDateStr);
  var millisPerDay = 1000 * 60 * 60 * 24;
  var prevDate = new Date(curDateObj.getTime() - millisPerDay * offset);
  return prevDate
}

function entryExists(curPayees, curAmount, curDate) {
  // This is used in order to avoid duplicates in transactions.
  // Return true if an entry with the same curPayees and curAmount exists within the past zero or more days, otherwise return false.
  // curPayees must be an array containing either one or more payees.
  // curAmount is the YNAB formatted dollar amount.
  // curDate is the YNAB formatted ISO datetime.
  var pastNumOfDays = 0;
  var prevDate = getPrevDate(curDate, pastNumOfDays);
  const url = `https://api.youneedabudget.com/v1/budgets/${budgetID}/accounts/${accountID}/transactions?since_date=${prevDate}`;
  const options = {
    muteHttpExceptions: true,
    "method": "get",
    "headers": {
      "accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    }
  };
  var res = UrlFetchApp.fetch(url, options);
  var resJson = JSON.parse(res);
  var transactions = resJson.data.transactions;
  for (var j = 0; j < curPayees.length; j++){
    for (var i = 0; i < transactions.length; i++) {
      var prevPayee = transactions[i]["payee_name"];
      var prevAmount = transactions[i]["amount"];
      if (curAmount == prevAmount && curPayees[j] == prevPayee) {
        return true;
      }
    }
  }
  return false;
}

function datetimeToISO(dateStr) {
  // Convert Gmail's datetime string to ISO format.
  // Sample dateStr: "Tue Aug 03 2021 03:19:09 GMT-0700 (Pacific Daylight Time)"
  var dtst = dateStr + "";
  var dtss = dtst.split(" ");
  var year = dtss[3];
  var month = monthToNum(dtss[1]);
  var day = dtss[2];
  return year + "-" + month + "-" + day
}

function createTimeTag(dateStr) {
  // Convert Gmail's datetime string to a time string that will be used for avoiding duplicates.
  // dateStr = Gmail's datetime string.
  // Sample dtst: "Tue Aug 03 2021 03:19:09 GMT-0700 (Pacific Daylight Time)"
  // Sample dtt:  031909
  var dtst = dateStr + "";
  var dtss = dtst.split(" ");
  var hour = dtss[4].split(":")[0];
  var minutes = dtss[4].split(":")[1];
  var seconds = dtss[4].split(":")[2];
  var dtt = hour + minutes + seconds;
  return dtt;
}

function addTransaction(payload) {
  // Send a POST to YNAB with the given payload to add a transaction.
  const url = `https://api.youneedabudget.com/v1/budgets/${budgetID}/transactions`;
  const options = {
    muteHttpExceptions: true,
    "method": "post",
    "headers": {
      "accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    "payload": JSON.stringify(payload)
  };
  UrlFetchApp.fetch(url, options);
}

function formatAmount(amount, flow) {
  // Convert the standard dollar amount string to a format that YNAB understands.
  // amount = the dollar amount (e.g. 2,453.99)
  // flow = either the "inflow" or "outflow", depends on the transaction.
  var retAmount = "";
  if (amount.indexOf(",") > -1) {
    amount = amount.replace(",", "");
    amount = +amount.split(".")[0] * 1000 + +("0." + amount.split(".")[1]) * 1000;
  } else {
    amount = +amount.split(".")[0] * 1000 + +("0." + amount.split(".")[1]) * 1000;
  }
  if (flow == "inflow") {
    retAmount = 1 * amount;
  } else if (flow == "outflow") {
    retAmount = -1 * amount;
  }
  return retAmount;
}

function createPayload(date, payee, amount, memo) {
  // Create a transaction payload that will be POSTed to YNAB.
  var payload = {
    "transaction": {
      "account_id": accountID,
      "date": date,
      "payee_name": payee,
      "amount": amount,
      "memo": memo,
      "cleared": "uncleared",
      "approved": false
    }
  };
  return payload;
}

function isCorrectBankAccount(msg) {
  // Check if the email is the correct email; check if it is for the right Chase bank account.
  // This is for the situation where you have multiple accounts with Chase that you want to budget for on YNAB.
  // Note that Quickpay/Zelle allows connection with only a single Chase bank account.
  // Comment out the Quickpay inflow code in the main function if this script is for the bank account NOT connected with Quickpay/Zelle.
  // Context: Quickpay alert email body does not have any information that tells us which Chase bank account it is connected with,
  // nevertheless Quickpay will always be connected to the single bank account that you choose on the "Pay & transfer" settings through Chase website.
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAccnt = msgArr[i].match(new RegExp(`.*${last4AcctNum}.*`, "i"));
    if (resAccnt) {
      return true;
    }
  }
  return false;
}

// ==============================================
// Core functions
// ==============================================

function debitOutflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var msgBody = msg.getPlainBody();
  var res = msgBody.match(/You made a debit card transaction of \$(.*) with (.*)/i);
  var curPayee = res[2] + " " + dtt;
  var curAmount = formatAmount(res[1], "outflow");
  var payload = createPayload(curDate, curPayee, curAmount, "");
  if (!entryExists([curPayee], curAmount, curDate)) {
    addTransaction(payload);
  }
}

function externalTransferOutflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var msgBody = msg.getPlainBody();
  var res = msgBody.match(/You sent \$(.*) to (.*)/i);
  var curPayee = res[2] + " " + dtt;
  var curAmount = formatAmount(res[1], "outflow");
  var payload = createPayload(curDate, curPayee, curAmount, "");
  if (!entryExists([curPayee], curAmount, curDate)) {
    addTransaction(payload);
  }
}

function directDepositInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "Direct Deposit " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/You have a direct deposit of \$(.*)/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "inflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function quickpayInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var msgBody = msg.getPlainBody();
  var resPayee = msgBody.match(/(.*)\ssent you.*QuickPay/);
  var curPayee = "QuickPay from " + resPayee[1] + " " + dtt;
  var resAmount = msgBody.match(/Amount:\*\s\$(.*).*\s\(/);
  var curAmount = formatAmount(resAmount[1], "inflow");
  var curMemo = "";
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resMemo = msgArr[i].match(/Memo:\*\s?(.*)/i);
    if (resMemo) {
      curMemo = resMemo[1];
      break;
    }
  }
  var payload = createPayload(curDate, curPayee, curAmount, curMemo);
  if (!entryExists([curPayee], curAmount, curDate)) {
    addTransaction(payload);
  }
}

function quickDepositInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "Quick Deposit " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/Amount Deposited:\s?\$(.*)/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "inflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function atmDepositAlertInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var msgBody = msg.getPlainBody();
  var res = msgBody.match(/\$(.*)\sATM deposit.*on\s(.*)\./i);
  var curAmount = formatAmount(res[1], "inflow");
  var curPayee = "ATM Deposit " + dtt;
  var payload = createPayload(curDate, curPayee, curAmount, "");
  if (!entryExists([curPayee], curAmount, curDate)) {
    addTransaction(payload);
  }
}

function atmDepositReceiptInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "ATM Deposit " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/Cash Dep to Chk.*\$(.*)\*/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "inflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function atmWithdrawalAlertOutflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "ATM Withdrawal " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/^You made an ATM withdrawal of \$(.*)$/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "outflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function wireIncomingInflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "Wire transfer " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/\$(.*) has exceeded/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "inflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function wireOutgoingOutflow(msg) {
  var curDate = datetimeToISO(msg.getDate());
  var dtt = createTimeTag(msg.getDate());
  var curPayee = "Wire transfer " + dtt;
  var msgBody = msg.getPlainBody();
  var msgArr = msgBody.split("\n");
  for (var i = 0; i < msgArr.length; i++) {
    var resAmount = msgArr[i].match(/\$(.*) was debited/i);
    if (resAmount) {
      var curAmount = formatAmount(resAmount[1], "outflow");
      var payload = createPayload(curDate, curPayee, curAmount, "");
      if (!entryExists([curPayee], curAmount, curDate)) {
        addTransaction(payload);
        break;
      }
    }
  }
}

function main() {
  Logger.clear();
  var threads = GmailApp.search("label:chase", 0, 24);
  for (var i = 0; i < threads.length; i++) {
    if (threads[i].isUnread()) {
      var messages = threads[i].getMessages();
      for (var j = 0; j < messages.length; j++) {
        var subject = messages[j].getSubject();
        // =====================================================================================================================
        // Inflow - Quickpay/Zelle alert.
        // =====================================================================================================================
        // Comment out the following IF BLOCK if this script is NOT for the bank account which is connected with Quickpay/Zelle.
        // Uncomment the following IF BLOCK if this script is for the Chase bank account that ends with last4AcctNum and
        // if the bank account is connected with Quickpay/Zelle.
        // =====================================================================================================================
        if (subject.indexOf("sent you") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          quickpayInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // All parsing operations after isCorrectBankAccount code below is related to a single Chase bank account last4AcctNum.
        // =====================================================================================================================
        if (!isCorrectBankAccount(messages[j])) {
          continue;
        }
        // =====================================================================================================================
        // Outflow - Debit card transaction alert.
        // =====================================================================================================================
        if (subject.indexOf("debit card transaction") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          debitOutflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Outflow - external tranfer alert.
        // =====================================================================================================================
        if (subject.indexOf("You sent") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          externalTransferOutflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Inflow - Direct deposit alert.
        // =====================================================================================================================
        if (subject.indexOf("direct deposit posted") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          directDepositInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Inflow - Quick deposit alert.
        // =====================================================================================================================
        if (subject.indexOf("Chase QuickDeposit") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          quickDepositInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Inflow - ATM deposit alert.
        // =====================================================================================================================
        if (subject.indexOf("ATM Deposit") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          atmDepositAlertInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Inflow - ATM deposit receipt alert.
        // =====================================================================================================================
        if (subject.indexOf("ATM receipt") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          atmDepositReceiptInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Outflow - ATM withdrawal alert.
        // =====================================================================================================================
        if (subject.indexOf("ATM withdrawal") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          atmWithdrawalAlertOutflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Inflow - Incoming wire transfer alert.
        // =====================================================================================================================
        if (subject.indexOf("Incoming Wire") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          wireIncomingInflow(messages[j]);
          threads[i].markRead();
        }
        // =====================================================================================================================
        // Outflow - Outgoing wire transfer alert.
        // =====================================================================================================================
        if (subject.indexOf("Your wire transfer alert") > -1) {
          // Logger.log("THREAD #" + (+i + 1) + " | MESSAGE #" + (+j + 1));
          wireOutgoingOutflow(messages[j]);
          threads[i].markRead();
        }
      }
    }
  }
}
