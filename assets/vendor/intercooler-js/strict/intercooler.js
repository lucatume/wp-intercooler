////////////////////////////////////

/**
 * Intercooler.js
 *
 * A javascript library for people who don't don't want to write a lot
 * of javascript.
 *
 */
var Intercooler = Intercooler || (function () {
  'use strict'; // inside function for better merging

  //--------------------------------------------------
  // Vars
  //--------------------------------------------------
  var _MACROS = ['ic-get-from', 'ic-post-to', 'ic-put-to', 'ic-delete-from',
                 'ic-style-src', 'ic-attr-src', 'ic-prepend-from', 'ic-append-from'];
  var _remote = jQuery;
  var _scrollHandler = null;
  var _UUID = 1;

  //============================================================
  // Base Transition Definitions
  //============================================================
  var _transitions = {};
  var _defaultTransition = 'fadeFast';
  function _defineTransition(name, def) {
    if(def.newContent == null) {
      //noinspection JSUnusedLocalSymbols
      def.newContent = function(parent, newContent, isReverse, replaceParent, after) {
        if(replaceParent) {
          parent.replaceWith(newContent);
          after(newContent);
        } else {
          parent.empty().append(newContent);
          after();
        }
      }
    }
    if(def.remove == null) {
      def.remove = function(elt) {
        elt.remove();
      }
    }
    if(def.show == null){
      def.show = function(elt) {
        elt.show();
      }
    }
    if(def.hide == null){
      def.hide = function(elt) {
        elt.hide();
      }
    }
    _transitions[name] = def;
  }
  _defineTransition('none', {});
  _defineTransition('fadeFast', {
    newContent : function(parent, newContent, isReverse, replaceParent, after){
      if(replaceParent) {
        parent.fadeOut('fast', function () {
          after(newContent.replaceAll(parent));
          newContent.fadeIn('fast');
        });
      } else {
        var fadeTarget = (parent.children().length == parent.contents().length & parent.contents().length > 0) ? parent.children() : parent;
        fadeTarget.fadeOut('fast', function () {
          parent.empty().append(newContent);
          fadeTarget.hide();
          after();
          fadeTarget.fadeIn('fast');
        });
      }
    },
    remove : function(elt) {
      elt.fadeOut('fast', function(){ elt.remove(); })
    },
    show : function(elt) {
      elt.fadeIn('fast');
    },
    hide : function(elt) {
      elt.fadeOut('fast');
    }
  });
  _defineTransition('prepend', {
    newContent : function(parent, newContent, isReverse, replaceParent, after){
      newContent.hide();
      parent.prepend(newContent);
      after();
      newContent.fadeIn();
      if (parent.attr('ic-limit-children')) {
        var limit = parseInt(parent.attr('ic-limit-children'));
        if (parent.children().length > limit) {
          parent.children().slice(limit, parent.children().length).remove();
        }
      }
    }
  });
  _defineTransition('append', {
    newContent : function(parent, newContent, isReverse, replaceParent, after){
      newContent.hide();
      parent.append(newContent);
      after();
      newContent.fadeIn();
      if (parent.attr('ic-limit-children')) {
        var limit = parseInt(parent.attr('ic-limit-children'));
        if (parent.children().length > limit) {
          parent.children().slice(0, parent.children().length - limit).remove();
        }
      }
    }
  });

  //============================================================
  // Utility Methods
  //============================================================

  function fingerprint(elt) {
    if(elt == null || elt == undefined) {
      return 0;
    }
    var str = elt.toString();
    var fp = 0, i, chr, len;
    if (str.length == 0) return fp;
    for (i = 0, len = str.length; i < len; i++) {
      chr = str.charCodeAt(i);
      fp = ((fp << 5) - fp) + chr;
      fp |= 0; // Convert to 32bit integer
    }
    return fp;
  }

  function log(elt, msg, level) {
    if(elt == null) {
      elt = jQuery('body');
    }
    elt.trigger("log.ic", [msg, level, elt]);
    if(level == "ERROR" && window.console) {
      window.console.log("Intercooler Error : " + msg);
    }
  }

  function uuid() {
    return _UUID++;
  }

  function icSelectorFor(elt) {
    return "[ic-id='" + getIntercoolerId(elt) + "']";
  }

  function findById(x) {
    return jQuery("#" + x);
  }

  function parseInterval(str) {
    log(null, "POLL: Parsing interval string " + str, 'DEBUG');
    if (str == "null" || str == "false" || str == "") {
      return null;
    } else if (str.lastIndexOf("ms") == str.length - 2) {
      return parseInt(str.substr(0, str.length - 2));
    } else if (str.lastIndexOf("s") == str.length - 1) {
      return parseInt(str.substr(0, str.length - 1)) * 1000;
    } else {
      return 1000;
    }
  }

  function initScrollHandler() {
    if (_scrollHandler == null) {
      _scrollHandler = function () {
        jQuery("[ic-trigger-on='scrolled-into-view']").each(function () {
          if (isScrolledIntoView(jQuery(this)) && jQuery(this).data('ic-scrolled-into-view-loaded') != true) {
            jQuery(this).data('ic-scrolled-into-view-loaded', true);
            fireICRequest(jQuery(this));
          }
        })
      };
      jQuery(window).scroll(_scrollHandler);
    }
  }

  function currentUrl() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  //============================================================
  // Request/Parameter/Include Processing
  //============================================================
  function getTarget(elt) {
    var targetValue = closestAttrValue(elt, 'ic-target');
    if(targetValue && targetValue.indexOf('this.') != 0) {
      if(targetValue.indexOf('closest ') == 0) {
        return elt.closest(targetValue.substr(8));
      } else {
        return jQuery(targetValue);
      }
    } else {
      return elt;
    }
  }

  function handleHistory(elt, xhr, originalHtml) {
    if (xhr.getResponseHeader("X-IC-PushURL")) {
      log(elt, "X-IC-PushURL: pushing " + xhr.getResponseHeader("X-IC-PushURL"), "DEBUG");
      _historySupport.pushUrl(xhr.getResponseHeader("X-IC-PushURL"), elt, originalHtml);
    } else {
      if(closestAttrValue(elt, 'ic-push-url') == "true") {
        _historySupport.pushUrl(elt.attr('ic-src'), elt, originalHtml);
      }
    }
  }

  function processHeaders(elt, xhr) {

    elt.trigger("beforeHeaders.ic", [elt, xhr]);
    log(elt, "response headers: " + xhr.getAllResponseHeaders(), "DEBUG");
    var target = null;
    if (xhr.getResponseHeader("X-IC-Refresh")) {
      var pathsToRefresh = xhr.getResponseHeader("X-IC-Refresh").split(",");
      log(elt, "X-IC-Refresh: refreshing " + pathsToRefresh, "DEBUG");
      jQuery.each(pathsToRefresh, function (i, str) {
        refreshDependencies(str.replace(/ /g, ""), elt);
      });
    }
    if (xhr.getResponseHeader("X-IC-Script")) {
      log(elt, "X-IC-Script: evaling " + xhr.getResponseHeader("X-IC-Script"), "DEBUG");
      eval(xhr.getResponseHeader("X-IC-Script"));
    }
    if (xhr.getResponseHeader("X-IC-Redirect")) {
      log(elt, "X-IC-Redirect: redirecting to " + xhr.getResponseHeader("X-IC-Redirect"), "DEBUG");
      window.location = xhr.getResponseHeader("X-IC-Redirect");
    }
    if (xhr.getResponseHeader("X-IC-CancelPolling") == "true") {
      cancelPolling(elt);
    }
    if (xhr.getResponseHeader("X-IC-Open")) {
      log(elt, "X-IC-Open: opening " + xhr.getResponseHeader("X-IC-Open"), "DEBUG");
      window.open(xhr.getResponseHeader("X-IC-Open"));
    }
    if(xhr.getResponseHeader("X-IC-Transition")) {
      log(elt, "X-IC-Transition: setting transition to  " + xhr.getResponseHeader("X-IC-Transition"), "DEBUG");
      target = getTarget(elt);
      target.data("ic-tmp-transition", xhr.getResponseHeader("X-IC-Transition"));
    }
    if(xhr.getResponseHeader("X-IC-Trigger")) {
      log(elt, "X-IC-Trigger: found trigger " + xhr.getResponseHeader("X-IC-Trigger"), "DEBUG");
      target = getTarget(elt);
      var triggerArgs = [];
      if(xhr.getResponseHeader("X-IC-Trigger-Data")){
        triggerArgs = jQuery.parseJSON(xhr.getResponseHeader("X-IC-Trigger-Data"))
      }
      target.trigger(xhr.getResponseHeader("X-IC-Trigger"), triggerArgs);
    }
    if (xhr.getResponseHeader("X-IC-Remove")) {
      if (elt) {
        target = getTarget(elt);
        log(elt, "X-IC-REMOVE header found.", "DEBUG");
        var transition = getTransition(elt, target);
        transition.remove(target);
      }
    }

    elt.trigger("afterHeaders.ic", [elt, xhr]);

    return true;
  }


  function beforeRequest(elt) {
    elt.addClass('disabled');
    elt.data('ic-request-in-flight', true);
  }

  function afterRequest(elt) {
    elt.removeClass('disabled');
    elt.data('ic-request-in-flight', false);
    if(elt.data('ic-next-request')) {
      elt.data('ic-next-request')();
      elt.data('ic-next-request', null);
    }
  }

  function replaceOrAddMethod(data, actualMethod) {
    var regex = /(&|^)_method=[^&]*/;
    var content = "&_method=" + actualMethod;
    if(regex.test(data)) {
      return data.replace(regex, content)
    } else {
      return data + "&" + content;
    }
  }

  function globalEval(script) {
    return window[ "eval" ].call(window, script);
  }

  function closestAttrValue(elt, attr) {
    var closestElt = jQuery(elt).closest('[' + attr + ']');
    if(closestElt) {
      return closestElt.attr(attr);
    } else {
      return null;
    }
  }

  function formatError(e) {
    var msg = e.toString() + "\n";
    try {
      msg += e.stack;
    } catch(e) {
      // ignore
    }
    return msg;
  }

  function handleRemoteRequest(elt, type, url, data, success) {

    beforeRequest(elt);

    data = replaceOrAddMethod(data, type);

    // Spinner support
    var indicator = findIndicator(elt);
    var indicatorTransition = getTransition(indicator, indicator);
    if(indicator.length > 0) {
      indicatorTransition.show(indicator);
    }

    var requestId = uuid();
    var requestStart = new Date();

    _remote.ajax({
      type: type,
      url: url,
      data: data,
      dataType: 'text',
      headers: {
        "Accept": "text/html-partial, */*; q=0.9",
        "X-IC-Request": true,
        "X-HTTP-Method-Override": type
      },
      beforeSend : function(xhr, settings){
        elt.trigger("beforeSend.ic", [elt, data, settings, xhr, requestId]);
        log(elt, "before AJAX request " + requestId + ": " + type + " to " + url, "DEBUG");
        var onBeforeSend = closestAttrValue(elt, 'ic-on-beforeSend');
        if(onBeforeSend) {
          globalEval('(function (data, settings, xhr) {' + onBeforeSend + '})')(data, settings, xhr);
        }
      },
      success: function (data, textStatus, xhr) {
        elt.trigger("success.ic", [elt, data, textStatus, xhr, requestId]);
        log(elt, "AJAX request " + requestId + " was successful.", "DEBUG");
        var onSuccess = closestAttrValue(elt, 'ic-on-success');
        if(onSuccess) {
          if(globalEval('(function (data, textStatus, xhr) {' + onSuccess + '})')(data, textStatus, xhr) == false) {
            return;
          }
        }

        var target = getTarget(elt);
        target.data("ic-tmp-transition",  closestAttrValue(elt, 'ic-transition')); // copy transition
        var beforeHeaders = new Date();
        try {
          if (processHeaders(elt, xhr)) {
            log(elt, "Processed headers for request " + requestId + " in " + (new Date() - beforeHeaders) + "ms", "DEBUG");
            var beforeSuccess = new Date();
            var originalHtml = target.html();
            success(data, textStatus, elt, xhr);
            handleHistory(elt, xhr, originalHtml);
            log(elt, "Process content for request " + requestId + " in " + (new Date() - beforeSuccess) + "ms", "DEBUG");
          }
          elt.trigger("after.success.ic", [elt, data, textStatus, xhr, requestId]);
        } catch (e) {
          log(elt, "Error processing successful request " + requestId + " : " + formatError(e), "ERROR");
        }
        target.data("ic-tmp-transition", null);
      },
      error: function (xhr, status, str) {
        elt.trigger("error.ic", [elt, status, str, xhr]);
        var onError = closestAttrValue(elt, 'ic-on-error');
        if(onError) {
          globalEval('(function (status, str, xhr) {' + onError + '})')(status, str, xhr);
        }
        log(elt, "AJAX request " + requestId + " experienced an error: " + str, "ERROR");
      },
      complete : function(xhr, status){
        log(elt, "AJAX request " + requestId + " completed in " + (new Date() - requestStart) + "ms", "DEBUG");
        afterRequest(elt);
        jQuery('body').trigger("complete.ic", [elt, data, status, xhr, requestId]);
        var onComplete = closestAttrValue(elt, 'ic-on-complete');
        if(onComplete) {
          globalEval('(function (xhr, status) {' + onComplete + '})')(xhr, status);
        }
        if (indicator.length > 0) {
          indicatorTransition.hide(indicator);
        }
      }
    })
  }

  function findIndicator(elt) {
    var indicator = null;
    if (jQuery(elt).attr('ic-indicator')) {
      indicator = jQuery(jQuery(elt).attr('ic-indicator')).first();
    } else {
      indicator = jQuery(elt).find(".ic-indicator").first();
      if (indicator.length == 0) {
        var parent = closestAttrValue(elt, 'ic-indicator');
        if (parent) {
          indicator = jQuery(parent).first();
        }
      }
    }
    return indicator;
  }

  function processIncludes(str) {
    var returnString = "";
    if(jQuery.trim(str).indexOf("{") == 0) {
      var obj = jQuery.parseJSON( str );
      jQuery.each(obj, function(key, value){
        returnString += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(value);
      });
    } else {
      jQuery(str).each(function(){
        returnString += "&" + jQuery(this).serialize();
      });
    }
    return returnString;
  }

  function getParametersForElement(elt, triggerOrigin) {
    var target = getTarget(elt);
    var str = "ic-request=true";

    // if the element is in a form, include the entire form
    if(elt.closest('form').length > 0) {
      str += "&" + elt.closest('form').serialize();
    } else { // otherwise include the element
      str += "&" + elt.serialize();
    }

    if (elt.attr('id')) {
      str += "&ic-element-id=" + elt.attr('id');
    }
    if (elt.attr('name')) {
      str += "&ic-element-name=" + elt.attr('name');
    }
    if (target.attr('ic-id')) {
      str += "&ic-id=" + target.attr('ic-id');
    }
    if (triggerOrigin && triggerOrigin.attr('id')) {
      str += "&ic-trigger-id=" + triggerOrigin.attr('id');
    }
    if (triggerOrigin && triggerOrigin.attr('name')) {
      str += "&ic-trigger-name=" + triggerOrigin.attr('name');
    }
    if (target.attr('ic-last-refresh')) {
      str += "&ic-last-refresh=" + target.attr('ic-last-refresh');
    }
    if (target.attr('ic-fingerprint')) {
      str += "&ic-fingerprint=" + target.attr('ic-fingerprint');
    }
    var includeAttr = closestAttrValue(elt, 'ic-include');
    if (includeAttr) {
      str += processIncludes(includeAttr);
    }
    str += "&ic-current-url=" + encodeURIComponent(currentUrl());
    log(elt, "request parameters " + str, "DEBUG");
    return str;
  }

  function maybeSetIntercoolerInfo(elt) {
    var target = getTarget(elt);
    getIntercoolerId(target);
    maybeSetIntercoolerMetadata(target);
    if(elt.data('elementAdded.ic') != true){
      elt.data('elementAdded.ic', true);
      elt.trigger("elementAdded.ic");
    }
  }

  function updateIntercoolerMetaData(elt) {
    elt.attr('ic-fingerprint', fingerprint(elt.html()));
    elt.attr('ic-last-refresh', new Date().getTime());
  }

  function maybeSetIntercoolerMetadata(elt) {
    if (!elt.attr('ic-fingerprint')) {
      updateIntercoolerMetaData(elt);
    }
  }

  function getIntercoolerId(elt) {
    if (!elt.attr('ic-id')) {
      elt.attr('ic-id', uuid());
    }
    return elt.attr('ic-id');
  }

  //============================================================
  // Tree Processing
  //============================================================

  function processNodes(elt) {
    processMacros(elt);
    processSources(elt);
    processPolling(elt);
    processTriggerOn(elt);
    processRemoveAfter(elt);
    jQuery(elt).trigger('nodesProcessed.ic');
  }

  function processSources(elt) {
    if (jQuery(elt).is("[ic-src]")) {
      maybeSetIntercoolerInfo(jQuery(elt));
    }
    jQuery(elt).find("[ic-src]").each(function () {
      maybeSetIntercoolerInfo(jQuery(this));
    });
  }

  //============================================================
  // Polling support
  //============================================================

  function startPolling(elt) {
    if(elt.data('ic-poll-interval-id') == null) {
      var interval = parseInterval(elt.attr('ic-poll'));
      if(interval != null) {
        var selector = icSelectorFor(elt);
        var repeats =  parseInt(elt.attr('ic-poll-repeats')) || -1;
        var currentIteration = 0;
        log(elt, "POLL: Starting poll for element " + selector, "DEBUG");
        var timerId = setInterval(function () {
          var target = jQuery(selector);
          elt.trigger("onPoll.ic", target);
          if ((target.length == 0) || (currentIteration == repeats)) {
            log(elt, "POLL: Clearing poll for element " + selector, "DEBUG");
            clearTimeout(timerId);
          } else {
            fireICRequest(target);
          }
          currentIteration++;
        }, interval);
        elt.data('ic-poll-interval-id', timerId);
      }
    }
  }

  function cancelPolling(elt) {
    if(elt.data('ic-poll-interval-id') != null) {
      clearTimeout(elt.data('ic-poll-interval-id'));
    }
  }

  function processPolling(elt) {
    if (jQuery(elt).is('[ic-poll]')) {
      maybeSetIntercoolerInfo(jQuery(elt));
      startPolling(elt);
    }
    jQuery(elt).find('[ic-poll]').each(function () {
      maybeSetIntercoolerInfo(jQuery(this));
      startPolling(jQuery(this));
    });
  }

  //============================================================----
  // Dependency support
  //============================================================----

  function refreshDependencies(dest, src) {
    log(src, "refreshing dependencies for path " + dest, "DEBUG");
    jQuery('[ic-src]').each(function () {
      var fired = false;
      if(verbFor(jQuery(this)) == "GET" && jQuery(this).attr('ic-deps') != 'ignore') {
        if (isDependent(dest, jQuery(this).attr('ic-src'))) {
          if (src == null || jQuery(src)[0] != jQuery(this)[0]) {
            fireICRequest(jQuery(this));
            fired = true;
          }
        } else if (isDependent(dest, jQuery(this).attr('ic-deps')) || jQuery(this).attr('ic-deps') == "*") {
          if (src == null || jQuery(src)[0] != jQuery(this)[0]) {
            fireICRequest(jQuery(this));
            fired = true;
          }
        }
      }
      if(fired) {
        log(jQuery(this), "depends on path " + dest + ", refreshing...", "DEBUG")
      }
    });
  }

  function isDependent(src, dest) {
    return (src && dest) && (dest.indexOf(src) == 0 || src.indexOf(dest) == 0);
  }

  //============================================================----
  // Trigger-On support
  //============================================================----

  function verbFor(elt) {
    if (elt.attr('ic-verb')) {
      return elt.attr('ic-verb').toUpperCase();
    }
    return "GET";
  }

  function eventFor(attr, elt) {
    if(attr == "default") {
      if(jQuery(elt).is('button')) {
        return 'click';
      } else if(jQuery(elt).is('form')) {
        return 'submit';
      } else if(jQuery(elt).is(':input')) {
        return 'change';
      } else {
        return 'click';
      }
    } else {
      return attr;
    }
  }

  function preventDefault(elt) {
    return elt.is('form') || (elt.is(':submit') && elt.closest('form').length == 1);
  }

  function handleRemoveAfter(elt) {
    if (jQuery(elt).attr('ic-remove-after')) {
      var transition = getTransition(elt, elt);
      var interval = parseInterval(jQuery(elt).attr('ic-remove-after'));
      setTimeout(function () { transition.remove(elt); }, interval);
    }
  }

  function handleTriggerOn(elt) {

    if (jQuery(elt).attr('ic-trigger-on')) {
      if (jQuery(elt).attr('ic-trigger-on') == 'load') {
        fireICRequest(elt);
      } else if (jQuery(elt).attr('ic-trigger-on') == 'scrolled-into-view') {
        initScrollHandler();
        setTimeout(function () { jQuery(window).trigger('scroll'); }, 100); // Trigger a scroll in case element is already viewable
      } else {
        var triggerOn = jQuery(elt).attr('ic-trigger-on').split(" ");
        jQuery(elt).on(eventFor(triggerOn[0], jQuery(elt)), function (e) {
          if(triggerOn[1] == 'changed') {
            var currentVal = jQuery(elt).val();
            var previousVal = jQuery(elt).data('ic-previous-val');
            jQuery(elt).data('ic-previous-val', currentVal);
            if( currentVal != previousVal ) {
              fireICRequest(jQuery(elt));
            }
          } else {
            fireICRequest(jQuery(elt));
          }
          if(preventDefault(elt)){
            e.preventDefault();
            return false;
          }
          return true;
        });
      }
    }
  }

  function processTriggerOn(elt) {
    handleTriggerOn(elt);
    jQuery(elt).find('[ic-trigger-on]').each(function () {
      handleTriggerOn(jQuery(this));
    });
  }

  function processRemoveAfter(elt) {
    handleRemoveAfter(elt);
    jQuery(elt).find('[ic-remove-after]').each(function () {
      handleRemoveAfter(jQuery(this));
    });
  }

  //============================================================----
  // Macro support
  //============================================================----

  function processMacros(elt) {
    jQuery.each(_MACROS, function (i, macro) {
      if (jQuery(elt).is('[' + macro + ']')) {
        processMacro(macro, jQuery(elt));
      }
      jQuery(elt).find('[' + macro + ']').each(function () {
        processMacro(macro, jQuery(this));
      });
    });
  }

  function processMacro(macro, elt) {
    // action attributes
    if(macro == 'ic-post-to') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-post-to'));
      setIfAbsent(elt, 'ic-verb', 'POST');
      setIfAbsent(elt, 'ic-trigger-on', 'default');
      setIfAbsent(elt, 'ic-deps', 'ignore');
    }
    if(macro == 'ic-put-to') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-put-to'));
      setIfAbsent(elt, 'ic-verb', 'PUT');
      setIfAbsent(elt, 'ic-trigger-on', 'default');
      setIfAbsent(elt, 'ic-deps', 'ignore');
    }
    if(macro == 'ic-get-from') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-get-from'));
      setIfAbsent(elt, 'ic-trigger-on', 'default');
      setIfAbsent(elt, 'ic-deps', 'ignore');
    }
    if(macro == 'ic-delete-from') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-delete-from'));
      setIfAbsent(elt, 'ic-verb', 'DELETE');
      setIfAbsent(elt, 'ic-trigger-on', 'default');
      setIfAbsent(elt, 'ic-deps', 'ignore');
    }
    // non-action attributes
    var value = null;
    var url = null;
    if(macro == 'ic-style-src') {
      value = elt.attr('ic-style-src').split(":");
      var styleAttribute = value[0];
      url = value[1];
      setIfAbsent(elt, 'ic-src', url);
      setIfAbsent(elt, 'ic-target', 'this.style.' + styleAttribute);
    }
    if(macro == 'ic-attr-src') {
      value = elt.attr('ic-attr-src').split(":");
      var attribute = value[0];
      url = value[1];
      setIfAbsent(elt, 'ic-src', url);
      setIfAbsent(elt, 'ic-target', 'this.' + attribute);
    }
    if(macro == 'ic-prepend-from') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-prepend-from'));
      setIfAbsent(elt, 'ic-transition', 'prepend');
    }
    if(macro == 'ic-append-from') {
      setIfAbsent(elt, 'ic-src', elt.attr('ic-append-from'));
      setIfAbsent(elt, 'ic-transition', 'append');
    }
  }

  function setIfAbsent(elt, attr, value) {
    if(elt.attr(attr) == null) {
      elt.attr(attr, value);
    }
  }

  //============================================================----
  // Utilities
  //============================================================----

  function isScrolledIntoView(elem) {
    var docViewTop = jQuery(window).scrollTop();
    var docViewBottom = docViewTop + jQuery(window).height();

    var elemTop = jQuery(elem).offset().top;
    var elemBottom = elemTop + jQuery(elem).height();

    return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom)
      && (elemBottom <= docViewBottom) && (elemTop >= docViewTop));
  }

  function getTransition(elt, target) {
    var transition = null;
    if(elt.attr('ic-transition')) {
      transition = _transitions[elt.attr('ic-transition')]
    }
    if(target.attr('ic-transition')) {
      transition = _transitions[target.attr('ic-transition')]
    }
    if(target.data('ic-tmp-transition')) {
      transition = _transitions[target.data('ic-tmp-transition')]
    }
    if(transition == null) {
      transition = _transitions[_defaultTransition];
    }
    if(transition == null) {
      transition = _transitions['none'];
    }
    return transition;
  }

  function processICResponse(newContent, elt) {
    if (newContent && /\S/.test(newContent)) {
      log(elt, "response content: \n" + newContent, "DEBUG");
      var target = getTarget(elt);

      // always update if the user tells us to or if there is a script (to reevaluate the script)
      var updateContent = closestAttrValue(elt, 'ic-always-update') != 'false' || newContent.indexOf("<script>") >= 0;
      if(updateContent == false) {
        var dummy = document.createElement('div');
        dummy.innerHTML = newContent;
        processMacros(dummy);
        updateContent = fingerprint(jQuery(dummy).html()) != target.attr('ic-fingerprint');
        if(dummy.remove) { //mobile fix
          dummy.remove();
        }
      }

      if (updateContent) {
        var transition = getTransition(elt, target);
        var isReplaceParent = closestAttrValue(elt, 'ic-replace-target') == "true";
        var contentToSwap = maybeFilter(newContent, closestAttrValue(elt, 'ic-select-from-response'));
        transition.newContent(target, contentToSwap, false, isReplaceParent, function (replacement) {
          if(replacement) {
            processNodes(replacement);
            updateIntercoolerMetaData(target);
          } else {
            jQuery(target).children().each(function() {
              processNodes(jQuery(this));
            });
            updateIntercoolerMetaData(target);
          }
          updateIntercoolerMetaData(target);
        });
      }
    }
  }

  function maybeFilter(newContent, filter) {
    var content = jQuery.parseHTML(newContent, null, true);
    var asQuery = jQuery(content);
    if(filter) {
      if(!asQuery.is(filter)) {
        asQuery = asQuery.find(filter);
      }
    }
    return  asQuery;
  }

  function getStyleTarget(elt) {
    var val = closestAttrValue(elt, 'ic-target');
    if(val && val.indexOf("this.style.") == 0) {
      return val.substr(11)
    } else {
      return null;
    }
  }

  function getAttrTarget(elt) {
    var val = closestAttrValue(elt, 'ic-target');
    if(val && val.indexOf("this.") == 0) {
      return val.substr(5)
    } else {
      return null;
    }
  }

  function fireICRequest(elt) {

    var triggerOrigin = elt;
    if(!elt.is('[ic-src]')) {
      elt = elt.closest('[ic-src]');
    }

    var confirmText = closestAttrValue(elt, 'ic-confirm');
    if(confirmText) {
      if(!confirm(confirmText)) {
        return;
      }
    }

    if(elt.length > 0) {
      var icEventId = uuid();
      elt.data('ic-event-id', icEventId);
      var invokeRequest = function () {

        // if an existing request is in flight for this element, push this request as the next to be executed
        if(elt.data('ic-request-in-flight') == true) {
          elt.data('ic-next-request', invokeRequest);
          return;
        }

        if (elt.data('ic-event-id') == icEventId) {
          var styleTarget = getStyleTarget(elt);
          var attrTarget = styleTarget ? null : getAttrTarget(elt);
          var verb = verbFor(elt);
          handleRemoteRequest(elt, verb, elt.attr('ic-src'), getParametersForElement(elt, triggerOrigin),
            function (data) {
              if (styleTarget) {
                elt.css(styleTarget, data);
              } else if (attrTarget) {
                elt.attr(attrTarget, data);
              } else {
                processICResponse(data, elt);
                if (verb != 'GET') {
                  refreshDependencies(elt.attr('ic-src'), elt);
                }
              }
            });
        }
      };

      var triggerDelay = closestAttrValue(elt, 'ic-trigger-delay');
      if (triggerDelay) {
        setTimeout(invokeRequest, parseInterval(triggerDelay));
      } else {
        invokeRequest();
      }
    }
  }

  //============================================================
  // History Support
  //============================================================

  var _historySupport = {

    currentRestorationId : null,
    // limit history slots to 200 total by default
    historyLimit : 200,

    clearHistory: function() {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++){
        if(localStorage.key(i).indexOf("ic-hist-elt-") == 0) {
          keys.push(localStorage.key(i));
        }
      }
      for (var j = 0; j < keys.length; j++){
        localStorage.removeItem(keys[j]);
      }
      localStorage.removeItem('ic-history-support');
    },

    newRestorationData : function(id, html){
      var histSupport = JSON.parse(localStorage.getItem('ic-history-support'));

      if (histSupport == null || !("slot" in histSupport)) {
        _historySupport.clearHistory();
        histSupport = {
          slot : 0
        };
      }

      var restorationData = {
        "id": "ic-hist-elt-" + histSupport.slot,
        "elementId": id,
        "content": html,
        "timestamp": new Date().getTime()
      };

      histSupport.slot = (histSupport.slot + 1) % _historySupport.historyLimit;

      //save the new element and history support data
      localStorage.setItem(restorationData.id, JSON.stringify(restorationData));
      localStorage.setItem('ic-history-support', JSON.stringify(histSupport));
      return restorationData;
    },

    updateHistoryData : function(id, html){
      var restorationData = JSON.parse(localStorage.getItem(id));
      if (restorationData == null) {
        log(jQuery('body'), "Could not find restoration data with id " + id, "ERROR");
        return
      }
      restorationData.content = html;
      //save the new element and history support data
      localStorage.setItem(restorationData.id, JSON.stringify(restorationData));
    },

    onPageLoad: function () {
      if (window.onpopstate == null || window.onpopstate['ic-on-pop-state-handler'] != true) {
        var currentOnPopState = window.onpopstate;
        window.onpopstate = function(event) {
          jQuery('body').trigger('handle.onpopstate.ic');
          if(!_historySupport.handlePop(event)){
            if(currentOnPopState) {
              currentOnPopState(event);
            }
          }
        };
        window.onpopstate['ic-on-pop-state-handler'] = true;
      }
    },

    pushUrl: function (url, elt, originalHtml) {
      log(elt, "pushing location into history: " + url, "DEBUG");

      var target = getTarget(elt);
      var id = target.attr('id');
      if(id == null) {
        log(elt, "To support history for a given element, you must have a valid id attribute on the element", "ERROR");
        return;
      }

      if(_historySupport.currentRestorationId != null) {
        _historySupport.updateHistoryData(_historySupport.currentRestorationId, originalHtml);
      } else {
        var originalData = _historySupport.newRestorationData(id, originalHtml);
        window.history.replaceState({"ic-id" : originalData.id}, "", "");
      }

      var restorationData = _historySupport.newRestorationData(id, target.html());
      window.history.pushState({'ic-id': restorationData.id}, "", url);
      _historySupport.currentRestorationId = restorationData.id;
      elt.trigger("pushUrl.ic", target, restorationData);
    },

    handlePop: function (event) {
      var data = event.state;
      if (data && data['ic-id']) {
        var historyData = JSON.parse(localStorage.getItem(data['ic-id']));
        if(historyData) {
          var elt = findById(historyData["elementId"]);
          if(_historySupport.currentRestorationId != null) {
            _historySupport.updateHistoryData(_historySupport.currentRestorationId, elt.html());
          }
          processICResponse(historyData["content"], elt);
          _historySupport.currentRestorationId = historyData.id;
          return true;
        }
      }
      return false;
    }
  };

  //============================================================
  // Bootstrap
  //============================================================

  jQuery(function () {
    processNodes('body');
    _historySupport.onPageLoad();
    if(location.search && location.search.indexOf("ic-launch-debugger=true") >= 0) {
      Intercooler.debug();
    }
  });

  return {

    /* ===================================================
     * Core API
     * =================================================== */
    refresh: function (val) {
      if (typeof val == 'string' || val instanceof String) {
        refreshDependencies(val);
      } else {
        fireICRequest(val);
      }
      return Intercooler;
    },

    updateHistory: function(id) {
      var restoData = _historySupport.newRestorationData(jQuery(id).attr('id'), jQuery(id).html());
      window.history.replaceState({"ic-id" : restoData.id}, "", "");
    },

    resetHistory: function() {
      _historySupport.clearHistory();
    },

    setHistoryLimit: function(count) {
      _historySupport.historyLimit = count;
    },

    processNodes: function(elt) {
      return processNodes(elt);
    },

    defaultTransition: function (name) {
      _defaultTransition = name;
    },

    defineTransition: function (name, def) {
      _defineTransition(name, def);
    },

    debug: function() {
      var debugPanel = jQuery(window).data('ic-debug-panel');
      if(debugPanel == null) {
        (function() {
          function generateDetailPanel(elt) {
            var dp = jQuery("<div><div><strong>Details</strong></div>" +
              "<div><strong>URL: </strong>" + elt.attr('ic-src') + "</div>" +
              "<div><strong>Verb: </strong>" + verbFor(elt) + "</div>" +
              (elt.attr('ic-trigger-on') ? "<div><strong>Trigger: </strong>" + elt.attr('ic-trigger-on') + "</div>" : "") +
              "</div>"
            );
            if(elt.attr('ic-target')) {
              dp.append(jQuery("<div><strong>Target: </strong></div>").append(linkForElt(getTarget(elt))));
            }
            if(elt.attr('ic-deps')) {
              dp.append(jQuery("<div><strong>Dependencies: </strong></div>").append(elt.attr('ic-deps')));
            }
            if(verbFor(elt) != "GET") {
              var depsList = jQuery("<div><strong>Dependant Elements:</strong><ul style='list-style-position: inside;font-size:12px;'></ul></div>")
                .appendTo(dp).find("ul");
              jQuery('[ic-src]').each(function () {
                if(verbFor(jQuery(this)) == "GET" && jQuery(this).attr('ic-deps') != 'ignore') {
                  if ((isDependent(elt.attr('ic-src'), jQuery(this).attr('ic-src'))) ||
                    (isDependent(elt.attr('ic-src'), jQuery(this).attr('ic-deps')) || jQuery(this).attr('ic-deps') == "*")) {
                    if (elt == null || elt[0] != jQuery(this)[0]) {
                      jQuery("<li style='font-size:12px'></li>").append(linkForElt(jQuery(this))).appendTo(depsList);
                    }
                  }
                }
              });
            }
            return dp;
          }

          function linkForElt(that) {
            if(that && that.length > 0) {
              return jQuery("<a style='border-bottom: 1px solid #d3d3d3'>&lt;" +
                that.prop("tagName").toLowerCase() +
                "&gt;" + (that.attr('ic-src') ? " - " + that.attr('ic-src') : "") +
                "</a>").data('ic-debug-elt', that);
            } else {
              return jQuery("<span>no element</span>")
            }
          }

          function generateDebugPanel() {
            return jQuery("<div id='ic-debug-panel' style='font-size: 14px;font-family: Arial;background:white;width:100%;height:200px;position:fixed;left:0;border-top: 1px solid #d3d3d3;'>" +
              "  <div style='padding:4px;width:100%;border-bottom: 1px solid #d3d3d3;background: #f5f5f5'><img src='/images/Intercooler_CMYK_noType_64.png' height='16px'> <strong>intercooler.js debugger</strong>" +
              "    <span style='float:right'><a>Hide</a> | <a>[x]</a></span>" +
              "  </div>" +
              "  <div style='padding:4px;width:100%;border-bottom: 1px solid #d3d3d3;'>" +
              "    <a style='font-weight: bold'>Elements</a> | <a>Logs</a> | <a>Errors</a>" +
              "  </div>" +
              "  <div>" +
              "    <div id='ic-debug-Elements'>" +
              "      <div id='ic-debug-Elements-list' style='width:200px;float: left;height: 142px;overflow-y: scroll;'>" +
              "      </div>" +
              "      <div id='ic-debug-Elements-detail' style='height: 142px;overflow-y: scroll;'>" +
              "      </div>" +
              "    </div>" +
              "    <div id='ic-debug-Logs' style='display:none;overflow-y: scroll;height: 142px'>" +
              "    </div>" +
              "    <div id='ic-debug-Errors' style='display:none;overflow-y: scroll;height: 142px'>" +
              "    </div>" +
              "  </div>" +
              "</div>");
          }

          function debugSourceElt(elt) {
            var eltLink = linkForElt(elt);
            eltLink.clone(true).css({'display' : 'block'}).appendTo(jQuery("#ic-debug-Elements-list"));
            if(elt.attr('ic-target') && getTarget(elt).length == 0) {
              jQuery("<div> - bad target selector:" + elt.attr('ic-target') + "</div>").prepend(eltLink.clone(true)).appendTo(jQuery("#ic-debug-Errors"));
            }
            if(elt.attr('ic-indicator') && jQuery(elt.attr('ic-indicator')).length == 0) {
              jQuery("<div> - bad indicator selector:" + elt.attr('ic-indicator') + "</div>").prepend(eltLink.clone(true)).appendTo(jQuery("#ic-debug-Errors"));
            }
            if(elt.attr('ic-push-url') && getTarget(jQuery(elt)).attr('id') == null) {
              jQuery("<div> - ic-push-url requires target to have id</div>").prepend(eltLink.clone(true)).appendTo(jQuery("#ic-debug-Errors"));
            }
          }

          function maybeCleanDebugInfo() {
            jQuery('#ic-debug-Elements-list').find('a').each(function(){
              if(jQuery(this).data('ic-debug-elt') && jQuery.contains( document.body, jQuery(this).data('ic-debug-elt')[0])) {
                // you live
              } else {
                jQuery(this).remove();
              }
            });
          }

          debugPanel = generateDebugPanel().appendTo(jQuery('body'));
          jQuery(window).data('ic-debug-panel', debugPanel);
          var lastElt;
          jQuery('#ic-debug-panel').on('click', 'a', function(){
            if(jQuery(this).text() == "Hide") {
              jQuery("#ic-debug-panel").data('ic-minimized', true);
              jQuery(this).text("Show");
              jQuery(window).resize();
            } else if (jQuery(this).text() == "Show") {
              jQuery("#ic-debug-panel").data('ic-minimized', false);
              jQuery(this).text("Hide");
              jQuery(window).resize();
            } else if (jQuery(this).text() == "[x]") {
              if(lastElt) {
                lastElt.css({'border': ''});
              }
              debugPanel.hide();
              jQuery('html').css('margin-bottom', "0");
            } else if (["Elements", "Logs", "Errors"].indexOf(jQuery(this).text()) >= 0) {
              jQuery(this).parent().find('a').css({"font-weight":"normal"});
              jQuery(this).css({"font-weight":"bold"});
              jQuery("#ic-debug-" + jQuery(this).text()).parent().children().hide();
              jQuery("#ic-debug-" + jQuery(this).text()).show();
            } else if(jQuery(this).data('ic-debug-elt')) {
              var that = jQuery(this);
              var newElt = that.data('ic-debug-elt');
              var delay = Math.min(newElt.offset().top - 75, 300);
              jQuery('html, body').animate({ scrollTop: newElt.offset().top - 75 }, delay);
              if(lastElt) {
                lastElt.css({'border': ''});
              }
              lastElt = newElt;
              newElt.css({'border' : "2px solid red"});
              if(that.parent().attr('id') == 'ic-debug-Elements-list') {
                jQuery('#ic-debug-Elements-detail').html(generateDetailPanel(newElt));
              }
            }
          });

          jQuery('[ic-src]').each(function(){
            debugSourceElt(jQuery(this));
          });

          jQuery(window).on('log.ic',function (e, msg, level) {
            jQuery("<div style='border-bottom: 1px solid #d3d3d3'>] - " + msg.replace(/</g, '&lt;') + "</div>")
              .appendTo(jQuery("#ic-debug-Logs"))
              .prepend(linkForElt(jQuery(e.target)))
              .prepend(level + " [");
          }).on('elementAdded.ic',function (e) {
              debugSourceElt(jQuery(e.target));
            }).on('nodesProcessed.ic',function () {
              maybeCleanDebugInfo();
            }).on('resize', function () {
              if(!debugPanel.is(":hidden")) {
                var winOffset = jQuery(window).height() - (debugPanel.data('ic-minimized') == true ? 29 : 200);
                debugPanel.css('top',  winOffset + "px");
                jQuery('html').css('margin-bottom', (debugPanel.data('ic-minimized') == true ? 29 : 200) + "px");
              }
            });
        })();
      } else {
        debugPanel.show();
      }
      jQuery(window).resize();
    },

    /* ===================================================
     * Mock Testing API
     * =================================================== */
    addURLHandler: function () {
      throw "This method is no longer supported.  Please use the jQuery mockjax plugin instead: https://github.com/jakerella/jquery-mockjax";
    },

    setRemote: function (remote) {
      _remote = remote;
      return Intercooler;
    }
  }
})();
