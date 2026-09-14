/*************************************************
 * Walk for Life 2026｜完賽回報前端
 *************************************************/

const WFL_FINISH_API_URL =
  'https://script.google.com/macros/s/AKfycbzn7OuVpu072gsCGnmEF2qBs8uZLlFrAStnBlTUTHIc-34xmcqWT9v8K2_mCxRIxBUB/exec';


document.addEventListener('DOMContentLoaded', function () {

  const modal =
    document.getElementById('finish-modal');

  const form =
    document.getElementById('finish-form');

  const alertBox =
    document.getElementById('finish-alert');

  const successBox =
    document.getElementById('finish-success');

  const successMessage =
    document.getElementById('finish-success-message');

  const submitButton =
    document.getElementById('finish-submit-button');

  const registrationInput =
    document.getElementById('finish-registration-id');


  if (!modal || !form) {
    console.warn('找不到完賽回報表單。');
    return;
  }


  /*************************************************
   * 完成日期不可選未來
   *************************************************/

  const finishDateInput =
    form.querySelector('[name="finishDate"]');

  if (finishDateInput) {
    finishDateInput.max =
      [getLocalDateString_(), '2026-11-30'].sort()[0];
  }


  /*************************************************
   * 開啟視窗
   *************************************************/

  function openFinishModal_(registrationId) {

    clearFinishAlert_();

    successBox.hidden = true;
    form.hidden = false;

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    modal.classList.add(
      'open'
    );

    document.body.style.overflow =
      'hidden';


    if (
      registrationId &&
      registrationInput
    ) {

      registrationInput.value =
        String(registrationId)
          .trim()
          .toUpperCase();

    }


    setTimeout(function () {

      if (registrationInput) {
        registrationInput.focus();
      }

    }, 100);

  }


  /*************************************************
   * 關閉視窗
   *************************************************/

  function closeFinishModal_() {

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.classList.remove(
      'open'
    );

    document.body.style.overflow =
      '';

  }


  /*************************************************
   * 「上傳完賽紀錄」按鈕
   *************************************************/

  document
    .querySelectorAll(
      '[data-open-finish]'
    )
    .forEach(function (button) {

      button.addEventListener(
        'click',
        function () {

          openFinishModal_('');

        }
      );

    });


  /*************************************************
   * 關閉按鈕
   *************************************************/

  document
    .querySelectorAll(
      '[data-close-finish]'
    )
    .forEach(function (button) {

      button.addEventListener(
        'click',
        function () {

          closeFinishModal_();

        }
      );

    });


  /*************************************************
   * ESC 關閉
   *************************************************/

  document.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key === 'Escape' &&
        modal.getAttribute(
          'aria-hidden'
        ) === 'false'
      ) {

        closeFinishModal_();

      }

    }
  );


  /*************************************************
   * 送出完賽回報
   *************************************************/

  form.addEventListener(
    'submit',
    async function (event) {

      event.preventDefault();

      clearFinishAlert_();


      /***********************************************
       * 取得資料
       ***********************************************/

      const registrationId =
        String(
          form.elements.registrationId
            .value || ''
        )
          .trim()
          .toUpperCase();


      const finishDate =
        String(
          form.elements.finishDate
            .value || ''
        ).trim();


      const distance =
        Number(
          form.elements.distance
            .value || 0
        );


      const note =
        String(
          form.elements.note
            .value || ''
        ).trim();


      const fileInput =
        form.elements.finishImage;


      const files = Array.from(fileInput?.files || []);
      const file = files[0];
      /***********************************************
       * 前端檢查
       ***********************************************/

      if (!registrationId) {

        showFinishAlert_(
          '請輸入報名編號或號碼布。'
        );

        return;

      }


      if (!finishDate) {

        showFinishAlert_(
          '請選擇完成日期。'
        );

        return;

      }


      if (
        !distance ||
        distance < 3
      ) {

        showFinishAlert_(
          '完成公里數需至少 3 公里。'
        );

        return;

      }


      if (!file) {

        showFinishAlert_(
          '請上傳運動紀錄截圖。'
        );

        return;

      }


      const allowedTypes = [

        'image/jpeg',

        'image/png',

        'image/webp'

      ];


      if (
        files.some(item => !allowedTypes.includes(item.type))
      ) {

        showFinishAlert_(
          '圖片格式只接受 JPG、PNG、WEBP。'
        );

        return;

      }


      if (
        files.some(item => item.size > 5 * 1024 * 1024) || files.length > 6
      ) {

        showFinishAlert_(
          '最多可選 6 張，每張圖片不可超過 5MB。'
        );

        return;

      }


      /***********************************************
       * 開始傳送
       ***********************************************/

      const originalButtonText =
        submitButton.textContent;


      submitButton.disabled = true;

      submitButton.textContent =
        '正在上傳，請稍候…';


      try {
        if (finishDate > getLocalDateString_() || finishDate > '2026-11-30') throw new Error('完成日期不可晚於今天或 11/30。');

        /*********************************************
         * 圖片 → Base64
         *********************************************/

        const imageBase64 = await combineFinishImages_(files);


        /*********************************************
         * API 資料
         *********************************************/

        const payload = {

          action:
            'finish',

          registrationId:
            registrationId,

          finishDate:
            finishDate,

          distance:
            distance,

          note:
            (files.length > 1 ? `[本次合併 ${files.length} 張截圖] ` : '') + note,

          imageBase64:
            imageBase64,

          imageMimeType:
            files.length > 1 ? 'image/jpeg' : file.type,

          imageFileName:
            files.length > 1 ? 'WFL-combined-records.jpg' : file.name

        };


        /*********************************************
         * 傳送到 Apps Script
         *********************************************/

        const response =
          await fetch(
            WFL_FINISH_API_URL,
            {

              method:
                'POST',

              headers: {

                'Content-Type':
                  'text/plain;charset=UTF-8'

              },

              body:
                JSON.stringify(
                  payload
                ),

              cache:
                'no-store',

              redirect:
                'follow'

            }
          );


        const responseText =
          await response.text();


        let result;


        try {

          result =
            JSON.parse(
              responseText
            );

        } catch (error) {

          console.error(
            'API 回傳內容：',
            responseText
          );

          throw new Error(
            '系統回傳格式異常，請稍後再試。'
          );

        }


        if (!result.ok) {

          throw new Error(
            result.message ||
            '完賽紀錄送出失敗。'
          );

        }


        /*********************************************
         * 成功
         *********************************************/

        form.hidden = true;

        successBox.hidden = false;


        if (successMessage) {

          successMessage.textContent =

            result.name +

            ' 您好，您的完賽紀錄已成功送出。' +

            '人工審核暫定於資料齊全後約兩週內完成。如需補件或兩週後仍未收到通知，請撥 049-2551119 分機 12，許先生，並提供報名編號。';

        }


        successBox.scrollIntoView({

          behavior:
            'smooth',

          block:
            'start'

        });


      } catch (error) {

        console.error(error);


        showFinishAlert_(

          error.message ||

          '送出失敗，請稍後再試。'

        );

      } finally {

        submitButton.disabled =
          false;

        submitButton.textContent =
          originalButtonText;

      }

    }
  );


  /*************************************************
   * QR Code / 專屬網址
   *
   * ?finish=WFL260001
   *
   * 自動：
   * 1. 開啟完賽回報
   * 2. 帶入報名編號
   *************************************************/

  const params =
    new URLSearchParams(
      window.location.search
    );


  const finishCode =
    params.get('finish');


  if (finishCode) {

    openFinishModal_(
      finishCode
    );

  }


  /*************************************************
   * 顯示錯誤
   *************************************************/

  function showFinishAlert_(
    message
  ) {

    if (!alertBox) {

      window.alert(message);
      return;

    }


    alertBox.textContent =
      message;

    alertBox.hidden =
      false;


    alertBox.scrollIntoView({

      behavior:
        'smooth',

      block:
        'center'

    });

  }


  /*************************************************
   * 清除錯誤
   *************************************************/

  function clearFinishAlert_() {

    if (!alertBox) return;

    alertBox.textContent =
      '';

    alertBox.hidden =
      true;

  }

});


/*************************************************
 * File → Base64
 *************************************************/

function readFileAsDataUrl_(
  file
) {

  return new Promise(
    function (
      resolve,
      reject
    ) {

      const reader =
        new FileReader();


      reader.onload =
        function () {

          resolve(
            reader.result
          );

        };


      reader.onerror =
        function () {

          reject(
            new Error(
              '圖片讀取失敗，請重新選擇圖片。'
            )
          );

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


/*************************************************
 * 取得本機日期 YYYY-MM-DD
 *************************************************/

function getLocalDateString_() {

  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );


  return (
    year +
    '-' +
    month +
    '-' +
    day
  );

}

// Preserve the existing single-image API contract: submit all selected records as one sheet.
async function combineFinishImages_(files) {
  if (files.length === 1) return readFileAsDataUrl_(files[0]);
  const images = [];
  try {
    for (const file of files) images.push(await createImageBitmap(file));
    if (images.some(im => !im.width || !im.height)) throw new Error('無法讀取圖片尺寸，請重新選擇截圖。');
    const width = Math.min(1600, Math.max(...images.map(im => im.width)));
    const heights = images.map(im => Math.round(im.height * width / im.width));
    const height = heights.reduce((a,b) => a+b, 0) + images.length * 40;
    if (height > 24000 || width * height > 24000000) throw new Error('截圖合併後過長，請減少張數或裁去無關空白後再選擇。');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('瀏覽器無法處理圖片，請改用其他瀏覽器。');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    let y = 0;
    images.forEach((im, i) => {
      ctx.fillStyle = '#213f3c'; ctx.font = '24px sans-serif';
      ctx.fillText(`${i+1} / ${images.length}`, 12, y+28);
      y += 40; ctx.drawImage(im, 0, y, width, heights[i]); y += heights[i];
    });
    for (const quality of [0.92, 0.84, 0.76]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.startsWith('data:image/jpeg;base64,') && Math.ceil(data.split(',')[1].length * 3/4) <= 5*1024*1024) return data;
    }
    throw new Error('合併後圖片超過 5MB，請縮小截圖後重試；不會只送出部分圖片。');
  } finally { images.forEach(im => im.close()); }
}
