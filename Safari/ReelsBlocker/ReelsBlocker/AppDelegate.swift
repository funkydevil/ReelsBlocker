//
//  AppDelegate.swift
//  ReelsBlocker
//
//  Created by K on 30/10/2026.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Override point for customization after application launch.
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}

// Borderless setup cards still need normal keyboard focus and accessibility.
final class SetupWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class SetupDragRegion: NSView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        let handle = NSBezierPath()
        handle.move(to: NSPoint(x: bounds.midX - 10, y: bounds.midY))
        handle.line(to: NSPoint(x: bounds.midX + 10, y: bounds.midY))
        handle.lineWidth = 2
        handle.lineCapStyle = .round
        NSColor.secondaryLabelColor.withAlphaComponent(0.25).setStroke()
        handle.stroke()
    }

    override func mouseDown(with event: NSEvent) {
        window?.performDrag(with: event)
    }
}
