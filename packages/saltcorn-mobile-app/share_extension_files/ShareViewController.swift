//
//  ShareViewController.swift
//  mindlib
//
//  Created by Carsten Klaffke on 05.07.20.
//

import MobileCoreServices
import Social
import UIKit

class ShareItem {

    public var title: String?
    public var type: String?
    public var url: String?
}

class ShareViewController: UIViewController {

    private var shareItems: [ShareItem] = []

    private func sendData() {
        // URLComponents.url already percent-encodes queryItems values when
        // building the final URL string - encoding them here too caused
        // double-encoding (e.g. "text/plain" arrived as "text%2Fplain"),
        // which broke type checks like isFileItem() on the JS side.
        let queryItems = shareItems.map {
            [
                URLQueryItem(name: "title", value: $0.title ?? ""),
                URLQueryItem(name: "description", value: ""),
                URLQueryItem(name: "type", value: $0.type ?? ""),
                URLQueryItem(name: "url", value: $0.url ?? ""),
            ]
        }.flatMap({ $0 })
        var urlComps = URLComponents(string: "scappscheme://")!
        urlComps.queryItems = queryItems
        openURL(urlComps.url!)
    }

    fileprivate func createSharedFileUrl(_ url: URL?) -> String {
        guard let url = url else { return "" }
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "YOUR_APP_GROUP_ID"
        ) else {
            return ""
        }
        // appendingPathComponent handles escaping correctly on its own -
        // hand-building a percent-encoded string here and then encoding it
        // *again* as a URLQueryItem value in sendData() double-encoded it,
        // so the path JS received didn't match any real file
        let destinationURL = containerURL.appendingPathComponent(url.lastPathComponent)

        // files vended by the Files app (iCloud, other apps' sandboxes) need
        // this before they can actually be read - without it, Data(contentsOf:)
        // fails and this used to silently return a path to a file that was
        // never written
        let didStartAccessing = url.startAccessingSecurityScopedResource()
        defer {
            if didStartAccessing { url.stopAccessingSecurityScopedResource() }
        }
        do {
            try Data(contentsOf: url).write(to: destinationURL)
            return destinationURL.absoluteString
        } catch {
            print("createSharedFileUrl failed: \(error)")
            return ""
        }
    }

    func saveScreenshot(_ image: UIImage, _ index: Int) -> String {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "YOUR_APP_GROUP_ID"
        ) else {
            return ""
        }
        let destinationURL = containerURL.appendingPathComponent("screenshot_\(index).png")
        do {
            try image.pngData()?.write(to: destinationURL)
            return destinationURL.absoluteString
        } catch {
            print("saveScreenshot failed: \(error.localizedDescription)")
            return ""
        }
    }

    fileprivate func handleTypeUrl(_ attachment: NSItemProvider)
    async throws -> ShareItem
    {
        let results = try await attachment.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil)
        guard let url = results as? URL else {
            throw NSError(domain: "ShareViewController", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "handleTypeUrl: expected a URL, got \(type(of: results))"
            ])
        }
        let shareItem: ShareItem = ShareItem()

        if url.isFileURL {
            shareItem.title = url.lastPathComponent
            shareItem.type = "application/" + url.pathExtension.lowercased()
            shareItem.url = createSharedFileUrl(url)
        } else {
            shareItem.title = url.absoluteString
            shareItem.url = url.absoluteString
            shareItem.type = "text/plain"
        }

        return shareItem
    }

    fileprivate func handleTypeText(_ attachment: NSItemProvider)
    async throws -> ShareItem
    {
        let results = try await attachment.loadItem(forTypeIdentifier: kUTTypeText as String, options: nil)
        let shareItem: ShareItem = ShareItem()
        let text = results as! String
        shareItem.title = text
        shareItem.type = "text/plain"
        return shareItem
    }

    fileprivate func handleTypeMovie(_ attachment: NSItemProvider)
    async throws -> ShareItem
    {
        let results = try await attachment.loadItem(forTypeIdentifier: kUTTypeMovie as String, options: nil)
        let shareItem: ShareItem = ShareItem()

        guard let url = results as? URL else {
            throw NSError(domain: "ShareViewController", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "handleTypeMovie: expected a URL, got \(type(of: results))"
            ])
        }
        shareItem.title = url.lastPathComponent
        shareItem.type = "video/" + url.pathExtension.lowercased()
        shareItem.url = createSharedFileUrl(url)
        return shareItem
    }

    fileprivate func handleTypeImage(_ attachment: NSItemProvider, _ index: Int)
    async throws -> ShareItem
    {
        let data = try await attachment.loadItem(forTypeIdentifier: kUTTypeImage as String, options: nil)

        let shareItem: ShareItem = ShareItem()
            switch data {
                case let image as UIImage:
                    shareItem.title = "screenshot_\(index)"
                    shareItem.type = "image/png"
                    shareItem.url = self.saveScreenshot(image, index)
                case let url as URL:
                    shareItem.title = url.lastPathComponent
                    shareItem.type = "image/" + url.pathExtension.lowercased()
                    shareItem.url = self.createSharedFileUrl(url)
                default:
                    print("Unexpected image data:", type(of: data))
        }
        return shareItem
    }

    override public func viewDidLoad() {
        super.viewDidLoad()

        shareItems.removeAll()

        let extensionItem = extensionContext?.inputItems[0] as! NSExtensionItem
        Task {
            do {
                try await withThrowingTaskGroup(
                    of: ShareItem.self,
                    body: { taskGroup in

                        for (index, attachment) in extensionItem.attachments!.enumerated() {
                            if attachment.hasItemConformingToTypeIdentifier(kUTTypeURL as String) {
                                taskGroup.addTask {
                                    return try await self.handleTypeUrl(attachment)
                                }
                            } else if attachment.hasItemConformingToTypeIdentifier(kUTTypeText as String) {
                                taskGroup.addTask {
                                    return try await self.handleTypeText(attachment)
                                }
                            } else if attachment.hasItemConformingToTypeIdentifier(kUTTypeMovie as String) {
                                taskGroup.addTask {
                                    return try await self.handleTypeMovie(attachment)
                                }
                            } else if attachment.hasItemConformingToTypeIdentifier(kUTTypeImage as String) {
                                taskGroup.addTask {
                                    return try await self.handleTypeImage(attachment, index)
                                }
                            }
                        }

                        for try await item in taskGroup {
                            self.shareItems.append(item)
                        }
                    })
            } catch {
                // a bad attachment (e.g. an unexpected type) still needs to
                // complete the request below, or the share sheet hangs
                print("viewDidLoad: task group failed: \(error)")
            }

            self.sendData()
            // only complete (letting the OS tear this extension down) once
            // sendData() has actually handed off to the host app - doing
            // this in viewDidAppear instead raced the async work above and
            // usually won, killing the extension before openURL() ran
            self.extensionContext!.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    @objc func openURL(_ url: URL) {
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
    }

}
