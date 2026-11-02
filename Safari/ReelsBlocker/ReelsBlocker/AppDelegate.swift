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

final class SetupCloseButton: NSButton {
    private var isHovered = false
    private var hoverArea: NSTrackingArea?

    override func updateTrackingAreas() {
        if let hoverArea = hoverArea { removeTrackingArea(hoverArea) }
        super.updateTrackingAreas()
        let area = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                                  owner: self, userInfo: nil)
        addTrackingArea(area)
        hoverArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        needsDisplay = true
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        let circle = NSBezierPath(ovalIn: bounds.insetBy(dx: 0.75, dy: 0.75))
        NSColor.labelColor.withAlphaComponent(isHighlighted ? 0.20 : isHovered ? 0.12 : 0.06).setFill()
        circle.fill()
        NSColor.labelColor.withAlphaComponent(0.10).setStroke()
        circle.lineWidth = 1
        circle.stroke()

        let cross = NSBezierPath()
        let mid = NSPoint(x: bounds.midX, y: bounds.midY)
        cross.move(to: NSPoint(x: mid.x - 3.5, y: mid.y - 3.5))
        cross.line(to: NSPoint(x: mid.x + 3.5, y: mid.y + 3.5))
        cross.move(to: NSPoint(x: mid.x - 3.5, y: mid.y + 3.5))
        cross.line(to: NSPoint(x: mid.x + 3.5, y: mid.y - 3.5))
        cross.lineWidth = 1.25
        cross.lineCapStyle = .round
        (isHovered ? NSColor.labelColor : NSColor.secondaryLabelColor).setStroke()
        cross.stroke()
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func drawFocusRingMask() {
        NSBezierPath(ovalIn: bounds.insetBy(dx: 0.75, dy: 0.75)).fill()
    }
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
