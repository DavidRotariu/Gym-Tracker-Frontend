---
title: "GrapheneOS (Workouts)"
section: "General"
source_url: https://help.macrofactorapp.com/en/articles/401-grapheneos-workouts
---

We don’t officially support GrapheneOS, which means that we aren’t testing every release of our apps on a variety of GrapheneOS devices and OS versions like we do for Android and iOS.   
  
We do have a single GrapheneOS test device, and are able to verify as needed that our apps work with this operating system. We can’t guarantee it will continue to work, as we can’t predict what the future of this operating system that less than 1% of our users have on their devices looks like. But, until this article says otherwise, our understanding is that **GrapheneOS works**, and we’ve had to take considerable steps to make that the case.

It’s quite simple, if you’ve installed GrapheneOS as per the official installation guide, and then you downloaded MacroFactor or MacroFactor Workouts using the sandboxed Google Play Store which is automatically included after installing Google Play services from the GrapheneOS App Store, our apps should run normally.  
  
When MacroFactor or MacroFactor Workouts launches you should get a notification that the app used the Play Integrity API (with a configuration that support GrapheneOS), do not choose to block usage attempts on the dialog tied to that notification.  
  
As per the GrapheneOS documentation: “The Play Store app is also the most secure way to install and update apps from the Play Store.” This absolutely true, and you’re taking unnecessary risks if you’re trying to do it any other way. The documentation also points out that you can instance the Google Play services installation into an extra profile designed only for apps that need Google Play services to function should you choose to do so.